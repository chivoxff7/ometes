class WebRTCManager {
  constructor() {
    this.localStream = null
    this.remoteStream = null
    this.peerConnection = null
    this.dataChannel = null
    this.isConnected = false
    this.configuration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    }

    this.onRemoteStream = null
    this.onDataChannelMessage = null
    this.onConnectionStateChange = null
  }

  async initializeMedia(videoDeviceId = null, audioDeviceId = null) {
    try {
      const constraints = {
        video: videoDeviceId ? { deviceId: videoDeviceId } : true,
        audio: audioDeviceId ? { deviceId: audioDeviceId } : true,
      }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      const localVideo = document.getElementById("localVideo")
      if (localVideo) {
        localVideo.srcObject = this.localStream
      }

      return this.localStream
    } catch (error) {
      console.error("Error accessing media devices:", error)
      throw error
    }
  }

  async getMediaDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return {
        cameras: devices.filter((device) => device.kind === "videoinput"),
        microphones: devices.filter((device) => device.kind === "audioinput"),
      }
    } catch (error) {
      console.error("Error getting media devices:", error)
      return { cameras: [], microphones: [] }
    }
  }

  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.configuration)

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream)
      })
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0]
      const remoteVideo = document.getElementById("remoteVideo")
      if (remoteVideo) {
        remoteVideo.srcObject = this.remoteStream
      }
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream)
      }
    }

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState
      this.isConnected = state === "connected"
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state)
      }
    }

    // Create data channel for text messages
    this.dataChannel = this.peerConnection.createDataChannel("messages")
    this.setupDataChannel(this.dataChannel)

    // Handle incoming data channel
    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel)
    }

    return this.peerConnection
  }

  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log("Data channel opened")
    }

    channel.onmessage = (event) => {
      if (this.onDataChannelMessage) {
        this.onDataChannelMessage(JSON.parse(event.data))
      }
    }

    channel.onclose = () => {
      console.log("Data channel closed")
    }
  }

  async createOffer() {
    if (!this.peerConnection) {
      this.createPeerConnection()
    }

    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)
    return offer
  }

  async createAnswer(offer) {
    if (!this.peerConnection) {
      this.createPeerConnection()
    }

    await this.peerConnection.setRemoteDescription(offer)
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    return answer
  }

  async setRemoteAnswer(answer) {
    await this.peerConnection.setRemoteDescription(answer)
  }

  sendMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(JSON.stringify(message))
      return true
    }
    return false
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        return videoTrack.enabled
      }
    }
    return false
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        return audioTrack.enabled
      }
    }
    return false
  }

  disconnect() {
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop())
    }

    this.dataChannel = null
    this.isConnected = false

    // Clear video elements
    const localVideo = document.getElementById("localVideo")
    const remoteVideo = document.getElementById("remoteVideo")
    if (localVideo) localVideo.srcObject = null
    if (remoteVideo) remoteVideo.srcObject = null
  }
}
