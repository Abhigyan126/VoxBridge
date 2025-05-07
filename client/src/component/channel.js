import React, { useEffect, useRef, useState } from "react";
import { Users, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Copy, Check } from "lucide-react";

const SIGNAL_SERVER = "wss://voxbridge-nrxh.onrender.com"; // ✅ Change to wss://yourdomain.com when hosted globally
const STUN_SERVER = { urls: "stun:stun.l.google.com:19302" };

export default function Channel() {
    const [connected, setConnected] = useState(false);
    const [roomName, setRoomName] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [isCreated, setIsCreated] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const wsRef = useRef(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const [isRemoteMuted, setIsRemoteMuted] = useState(false);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [clientName, setClientName] = useState("");
    const [clientList, setClientList] = useState([]);
    const [copied, setCopied] = useState(false);




    useEffect(() => {
        wsRef.current = new WebSocket(SIGNAL_SERVER);

        wsRef.current.onmessage = async (msg) => {
            try {
                const data = JSON.parse(msg.data);

                switch (data.type) {
                    case "created":
                        setRoomCode(data.roomCode);
                        setIsCreated(true);
                        break;

                    case "joined":
                        setIsJoined(true);
                        break;

                    case "error":
                        alert(data.message);
                        break;

                    case "offer":
                        await createPeerConnection();
                        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                        const answer = await pcRef.current.createAnswer();
                        await pcRef.current.setLocalDescription(answer);
                        wsRef.current.send(JSON.stringify({ type: "answer", answer }));
                        break;

                    case "answer":
                        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                        break;

                    case "candidate":
                        if (data.candidate) {
                            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                        }
                        break;
                    case "client_list":
                        setClientList(data.clients);
                        break;


                    default:
                        console.warn("Unknown message type:", data.type);
                }
            } catch (err) {
                console.error("Error parsing message", err);
            }
        };

        return () => {
            wsRef.current?.close();
        };
    }, []);

    const createPeerConnection = async () => {
        pcRef.current = new RTCPeerConnection({ iceServers: [STUN_SERVER] });

        pcRef.current.onicecandidate = (event) => {
            if (event.candidate) {
                wsRef.current.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
            }
        };

        pcRef.current.ontrack = (event) => {
            const remoteAudio = document.getElementById("remoteAudio");
            if (remoteAudio.srcObject !== event.streams[0]) {
                remoteAudio.srcObject = event.streams[0];
            }
        };

        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

        localStreamRef.current.getTracks().forEach(track =>
            pcRef.current.addTrack(track, localStreamRef.current)
        );

        const localAudio = document.getElementById("localAudio");
        localAudio.srcObject = localStreamRef.current;
    };

    const startCall = async () => {
        setConnected(true);
        await createPeerConnection();
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        wsRef.current.send(JSON.stringify({ type: "offer", offer }));
    };

    const handleCreateRoom = () => {
        if (roomName.trim() === "") return alert("Enter a group name");
        wsRef.current.send(JSON.stringify({ type: "create", roomName, clientName }));
    };

    const handleJoinRoom = () => {
        if (roomCode.trim() === "") return alert("Enter a valid room code");
        wsRef.current.send(JSON.stringify({ type: "join", roomCode, clientName }));
    };

    const toggleRemoteMute = () => {
        const remoteAudio = document.getElementById("remoteAudio");
        if (remoteAudio) {
            remoteAudio.muted = !remoteAudio.muted;
            setIsRemoteMuted(remoteAudio.muted);
        }
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicMuted(!audioTrack.enabled);
            }
        }
    };

    
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center mb-6">
          <Phone className="h-8 w-8 text-indigo-600 mr-2" />
          <h1 className="text-2xl font-bold text-gray-800">Vox Bridge</h1>
        </div>

        {!isCreated && !isJoined ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h2 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
                <Users className="h-5 w-5 mr-2 text-indigo-500" />
                Create a Room
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Group Name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleCreateRoom}
                  disabled={!clientName || !roomName}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Create Room
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
                <Phone className="h-5 w-5 mr-2 text-indigo-500" />
                Join a Room
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter Room Code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={!clientName || !roomCode}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Room Code</p>
                  <div className="flex items-center">
                    <code className="text-lg font-mono font-medium text-indigo-600">
                      {roomCode}
                    </code>
                    <button
                      onClick={copyRoomCode}
                      className="ml-2 p-1 text-gray-500 hover:text-indigo-600 focus:outline-none"
                      aria-label="Copy room code"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={startCall}
                  disabled={connected}
                  className={`flex items-center px-4 py-2 rounded-md font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    connected
                      ? "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                      : "bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white"
                  }`}
                >
                  {connected ? (
                    <>
                      <PhoneOff className="h-4 w-4 mr-1" /> End
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4 mr-1" /> Start Call
                    </>
                  )}
                </button>
              </div>
            </div>

            {connected && (
              <div>
                <div className="flex justify-center space-x-2 mb-4">
                  <audio id="localAudio" autoPlay muted className="hidden" />
                  <audio id="remoteAudio" autoPlay className="hidden" />
                  
                  <button
                    onClick={toggleMic}
                    className={`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isMicMuted
                        ? "bg-gray-200 text-gray-600 hover:bg-gray-300 focus:ring-gray-500"
                        : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 focus:ring-indigo-500"
                    }`}
                    aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                  >
                    {isMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </button>
                  
                  <button
                    onClick={toggleRemoteMute}
                    className={`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isRemoteMuted
                        ? "bg-gray-200 text-gray-600 hover:bg-gray-300 focus:ring-gray-500"
                        : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 focus:ring-indigo-500"
                    }`}
                    aria-label={isRemoteMuted ? "Unmute remote audio" : "Mute remote audio"}
                  >
                    {isRemoteMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                  </button>
                </div>
                
                {clientList.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Users className="h-4 w-4 mr-1 text-indigo-500" />
                      Connected Users ({clientList.length})
                    </h3>
                    <ul className="space-y-1">
                      {clientList.map((name, idx) => (
                        <li key={idx} className="flex items-center py-1">
                          <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-sm text-gray-800">{name}</span>
                          {name === clientName && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                              You
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    );
}
