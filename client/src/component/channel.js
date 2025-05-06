import React, { useEffect, useRef, useState } from "react";

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
        wsRef.current.send(JSON.stringify({ type: "create", roomName }));
    };

    const handleJoinRoom = () => {
        if (roomCode.trim() === "") return alert("Enter a valid room code");
        wsRef.current.send(JSON.stringify({ type: "join", roomCode }));
    };

    return (
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <h2>React WebRTC P2P Voice Chat</h2>

            {!isCreated && !isJoined && (
                <div>
                    <h4>Create a Room</h4>
                    <input
                        placeholder="Group Name"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                    />
                    <button onClick={handleCreateRoom}>Create</button>

                    <h4 style={{ marginTop: "2rem" }}>OR Join a Room</h4>
                    <input
                        placeholder="Room Code"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                    />
                    <button onClick={handleJoinRoom}>Join</button>
                </div>
            )}

            {(isCreated || isJoined) && (
                <div style={{ marginTop: "2rem" }}>
                    <h4>Room Code: <code>{roomCode}</code></h4>
                    <button onClick={startCall} disabled={connected}>
                        Start Call
                    </button>

                    <div style={{ marginTop: "2rem" }}>
                        <p><b>Local Audio:</b></p>
                        <audio id="localAudio" autoPlay muted />
                        <p><b>Remote Audio:</b></p>
                        <audio id="remoteAudio" autoPlay />
                    </div>
                </div>
            )}
        </div>
    );
}
