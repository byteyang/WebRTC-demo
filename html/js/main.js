"use strict";

var localVideo = document.querySelector("video#localvideo");
var remoteVideo = document.querySelector("video#remotevideo");

var btnConn = document.querySelector("button#connserver");
var btnLeave = document.querySelector("button#leave");

var offer = document.querySelector("textarea#offer");
var answer = document.querySelector("textarea#answer");

var shareDeskBox = document.querySelector("input#shareDesk");

var pcConfig = {
  iceServers: [
    {
      urls: "turn:stun.ukerd.com:3478",
      credential: "123456",
      username: "lvming",
    },
  ],
};

var localStream = null;
var remoteStream = null;

var pc = null;

var roomid;
var socket = null;

var offerdesc = null;
var state = "init";

function IsPC() {
  var userAgentInfo = navigator.userAgent;
  var Agents = [
    "Android",
    "iPhone",
    "SymbianOS",
    "Windows Phone",
    "iPad",
    "iPod",
  ];
  var flag = true;

  for (var v = 0; v < Agents.length; v++) {
    if (userAgentInfo.indexOf(Agents[v]) > 0) {
      flag = false;
      break;
    }
  }

  return flag;
}

function is_android() {
  var u = navigator.userAgent,
    app = navigator.appVersion;
  var isAndroid = u.indexOf("Android") > -1 || u.indexOf("Linux") > -1; //g
  var isIOS = !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/); //ios终端
  if (isAndroid) {
    return true;
  }

  if (isIOS) {
    return false;
  }
}

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] == variable) {
      return pair[1];
    }
  }
  return false;
}

//=======================================================================

function sendMessage(roomid, data) {
  console.log("send message to other end", roomid, data);
  if (!socket) {
    console.log("socket is null");
  }
  socket.emit("message", roomid, data);
}

function conn() {
  socket = io.connect("http://localhost:7001");

  socket.on("joined", (roomid, id) => {
    console.log("receive joined message!", roomid, id);
    state = "joined";

    createPeerConnection();
    bindTracks();

    btnConn.disabled = true;
    btnLeave.disabled = false;
    console.log("receive joined message, state=", state);
  });

  socket.on("otherjoin", (roomid) => {
    console.log("receive joined message:", roomid, state);

    if (state === "joined_unbind") {
      createPeerConnection();
      bindTracks();
    }

    state = "joined_conn";
    call();

    console.log("receive other_join message, state=", state);
  });

  socket.on("full", (roomid, id) => {
    console.log("receive full message", roomid, id);
    socket.disconnect();
    hangup();
    closeLocalMedia();
    state = "leaved";
    console.log("receive full message, state=", state);
    alert("the room is full!");
  });

  socket.on("leaved", (roomid, id) => {
    console.log("receive leaved message", roomid, id);
    state = "leaved";
    socket.disconnect();
    console.log("receive leaved message, state=", state);

    btnConn.disabled = false;
    btnLeave.disabled = true;
  });

  socket.on("bye", (room, id) => {
    console.log("receive bye message", roomid, id);
    state = "joined_unbind";
    hangup();
    offer.value = "";
    answer.value = "";
    console.log("receive bye message, state=", state);
  });

  socket.on("disconnect", (socket) => {
    console.log("receive disconnect message!", roomid);
    if (!(state === "leaved")) {
      hangup();
      closeLocalMedia();
    }
    state = "leaved";
  });

  socket.on("message", (roomid, data) => {
    console.log("receive message!", roomid, data);

    if (data === null || data === undefined) {
      console.error("the message is invalid!");
      return;
    }

    if (data.hasOwnProperty("type") && data.type === "offer") {
      offer.value = data.sdp;

      pc.setRemoteDescription(new RTCSessionDescription(data));

      pc.createAnswer().then(getAnswer).catch(handleAnswerError);
    } else if (data.hasOwnProperty("type") && data.type == "answer") {
      answer.value = data.sdp;
      pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.hasOwnProperty("type") && data.type === "candidate") {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: data.label,
        candidate: data.candidate,
      });
      pc.addIceCandidate(candidate);
    } else {
      console.log("the message is invalid!", data);
    }
  });

  roomid = getQueryVariable("room");
  socket.emit("join", roomid);

  return true;
}

function connSignalServer() {
  start();

  return true;
}

function getMediaStream(stream) {
  if (localStream) {
    stream.getAudioTracks().forEach((track) => {
      localStream.addTrack(track);
      stream.removeTrack(track);
    });
  } else {
    localStream = stream;
  }

  localVideo.srcObject = localStream;

  conn();
}

function getDeskStream(stream) {
  localStream = stream;
}

function handleError(err) {
  console.error("Failed to get Media Stream!", err);
}

function shareDesk() {
  if (IsPC()) {
    navigator.mediaDevices
      .getDisplayMedia({ video: true })
      .then(getDeskStream)
      .catch(handleError);

    return true;
  }

  return false;
}

function start() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error("the getUserMedia is not supported!");
    return;
  } else {
    var constraints;

    if (shareDeskBox.checked && shareDesk()) {
      constraints = {
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
    } else {
      constraints = {
        video: {
          width: 640,
          height: 480,
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
    }

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(getMediaStream)
      .catch(handleError);
  }
}

function getRemoteStream(e) {
  remoteStream = e.streams[0];
  remoteVideo.srcObject = e.streams[0];
}

function handleOfferError(err) {
  console.error("Failed to create offer:", err);
}

function handleAnswerError(err) {
  console.error("Failed to create answer:", err);
}

function getAnswer(desc) {
  pc.setLocalDescription(desc);
  answer.value = desc.sdp;

  //send answer sdp
  sendMessage(roomid, desc);
}

function getOffer(desc) {
  pc.setLocalDescription(desc);
  offer.value = desc.sdp;
  offerdesc = desc;

  //send offer sdp
  sendMessage(roomid, offerdesc);
}

function createPeerConnection() {
  console.log("create RTCPeerConnection!");
  if (!pc) {
    pc = new RTCPeerConnection(pcConfig);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendMessage(roomid, {
          type: "candidate",
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        });
      } else {
        console.log("this is the end candidate");
      }
    };

    pc.ontrack = getRemoteStream;
  } else {
    console.log("the pc have be created!");
  }

  return;
}

function bindTracks() {
  console.log("bind tracks into RTCPeerConnection!");

  if (pc === null || localStream === undefined) {
    console.error("pc is null or undefined!");
    return;
  }

  if (localStream === null || localStream === undefined) {
    console.error("localstream is null or undefined!");
    return;
  }

  //add all track into peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });
}

function call() {
  if (state === "joined_conn") {
    var offerOptions = {
      offerToRecieveAudio: 1,
      offerToRecieveVideo: 1,
    };

    pc.createOffer(offerOptions).then(getOffer).catch(handleOfferError);
  }
}

function hangup() {
  if (!pc) {
    return;
  }

  offerdesc = null;

  pc.close();
  pc = null;
}

function closeLocalMedia() {
  if (!(localStream === null || localStream === undefined)) {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
  }
  localStream = null;
}

function leave() {
  socket.emit("leave", roomid); //notify server

  hangup();
  closeLocalMedia();

  offer.value = "";
  answer.value = "";
  btnConn.disabled = false;
  btnLeave.disabled = true;
}

btnConn.onclick = connSignalServer;
btnLeave.onclick = leave;
