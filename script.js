class AutoOmeChat {
  constructor() {
    this.socket = null
    this.currentMode = "text"
    this.isConnected = false
    this.localStream = null
    this.peerConnection = null
    this.partnerId = null
    this.myId = null
    this.serverUrls = this.getServerUrls()
    this.currentServerIndex = 0

    this.init()
  }

  getServerUrls() {
    // Detectar automáticamente las URLs del servidor
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.hostname
    const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80")

    return [
      `${protocol}//${host}:3000`, // Puerto estándar del servidor
      `${protocol}//${host}:${port}`, // Mismo puerto que la web
      `${protocol}//${host}:8080`, // Puerto alternativo común
      `ws://localhost:3000`, // Desarrollo local
      `wss://omechat-server.herokuapp.com`, // Servidor en la nube (ejemplo)
    ]
  }

  init() {
    this.bindEvents()
    this.updateConnectionStatus("connecting")
    // Conectar automáticamente al cargar la página
    this.autoConnect()
  }

  async autoConnect() {
    console.log("🔄 Conectando automáticamente...")

    for (let i = 0; i < this.serverUrls.length; i++) {
      const serverUrl = this.serverUrls[i]
      console.log(`Intentando conectar a: ${serverUrl}`)

      try {
        const connected = await this.tryConnect(serverUrl)
        if (connected) {
          console.log(`✅ Conectado exitosamente a: ${serverUrl}`)
          return
        }
      } catch (error) {
        console.log(`❌ Falló conexión a: ${serverUrl}`)
      }
    }

    // Si no se pudo conectar a ningún servidor
    this.updateConnectionStatus("offline")
    this.addSystemMessage("No se pudo conectar al servidor. Verifica tu conexión a internet.", "disconnected")
  }

  tryConnect(serverUrl) {
    return new Promise((resolve) => {
      const testSocket = new WebSocket(serverUrl)

      const timeout = setTimeout(() => {
        testSocket.close()
        resolve(false)
      }, 5000) // 5 segundos timeout

      testSocket.onopen = () => {
        clearTimeout(timeout)
        testSocket.close()
        this.connectToServer(serverUrl)
        resolve(true)
      }

      testSocket.onerror = () => {
        clearTimeout(timeout)
        resolve(false)
      }
    })
  }

  bindEvents() {
    // Welcome screen events
    document.querySelectorAll(".option-card").forEach((card) => {
      card.addEventListener("click", (e) => this.selectChatMode(e))
    })

    document.getElementById("startChatBtn").addEventListener("click", () => this.startChat())

    // Chat screen events
    document.getElementById("messageInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.sendMessage()
    })

    document.getElementById("sendBtn").addEventListener("click", () => this.sendMessage())
    document.getElementById("newChatBtn").addEventListener("click", () => this.findNewPartner())
    document.getElementById("toggleVideoBtn").addEventListener("click", () => this.toggleVideo())
    document.getElementById("toggleAudioBtn").addEventListener("click", () => this.toggleAudio())
    document.getElementById("stopChatBtn").addEventListener("click", () => this.disconnectFromPartner())
  }

  selectChatMode(e) {
    document.querySelectorAll(".option-card").forEach((card) => {
      card.classList.remove("selected")
    })

    e.currentTarget.classList.add("selected")
    this.currentMode = e.currentTarget.dataset.mode
  }

  async startChat() {
    const startBtn = document.getElementById("startChatBtn")
    startBtn.classList.add("loading")

    // Si no hay conexión, intentar reconectar
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      await this.autoConnect()
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.showChatScreen()
      this.registerUser()
    } else {
      startBtn.classList.remove("loading")
      this.addSystemMessage("No se pudo establecer conexión con el servidor", "disconnected")
    }
  }

  connectToServer(serverUrl) {
    try {
      this.socket = new WebSocket(serverUrl)

      this.socket.onopen = () => {
        console.log("✅ Conectado al servidor")
        this.updateConnectionStatus("online")
      }

      this.socket.onmessage = (event) => {
        this.handleServerMessage(JSON.parse(event.data))
      }

      this.socket.onclose = () => {
        console.log("❌ Desconectado del servidor")
        this.updateConnectionStatus("offline")
        this.addSystemMessage("Conexión perdida. Intentando reconectar...", "disconnected")

        // Intentar reconectar automáticamente
        setTimeout(() => {
          this.autoConnect()
        }, 3000)
      }

      this.socket.onerror = (error) => {
        console.error("Error de conexión:", error)
      }
    } catch (error) {
      console.error("Error conectando:", error)
      this.updateConnectionStatus("offline")
    }
  }

  registerUser() {
    this.myId = this.generateUserId()

    const message = {
      type: "register",
      userId: this.myId,
      mode: this.currentMode,
    }

    this.sendToServer(message)
  }

  handleServerMessage(message) {
    console.log("📨 Mensaje del servidor:", message.type)

    switch (message.type) {
      case "registered":
        this.onUserRegistered(message)
        break
      case "partner_found":
        this.onPartnerFound(message)
        break
      case "partner_disconnected":
        this.onPartnerDisconnected()
        break
      case "message":
        this.onMessageReceived(message)
        break
      case "offer":
        this.onOfferReceived(message)
        break
      case "answer":
        this.onAnswerReceived(message)
        break
      case "ice_candidate":
        this.onIceCandidateReceived(message)
        break
      case "user_count":
        this.updateOnlineCount(message.count)
        break
      case "error":
        this.addSystemMessage(`Error: ${message.message}`, "disconnected")
        break
    }
  }

  onUserRegistered(message) {
    console.log("👤 Usuario registrado:", message.userId)
    this.findPartner()
  }

  onPartnerFound(message) {
    this.partnerId = message.partnerId
    this.isConnected = true

    this.addSystemMessage(`🎉 Conectado con una persona real!`, "connected")

    // Enable chat input
    document.getElementById("messageInput").disabled = false
    document.getElementById("sendBtn").disabled = false

    // Initialize video if needed
    if (this.currentMode === "video") {
      this.initializeVideo()
    }
  }

  onPartnerDisconnected() {
    this.isConnected = false
    this.partnerId = null

    this.addSystemMessage("😔 La persona se desconectó", "disconnected")

    // Disable chat input
    document.getElementById("messageInput").disabled = true
    document.getElementById("sendBtn").disabled = true

    // Clean up video
    this.cleanupVideo()
  }

  onMessageReceived(message) {
    if (message.from === this.partnerId) {
      this.addMessage(message.text, "other")
    }
  }

  async onOfferReceived(message) {
    if (!this.peerConnection) {
      await this.createPeerConnection()
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer))
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)

    this.sendToServer({
      type: "answer",
      to: message.from,
      answer: answer,
    })
  }

  async onAnswerReceived(message) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
  }

  async onIceCandidateReceived(message) {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
    }
  }

  showChatScreen() {
    document.getElementById("welcomeScreen").classList.add("hidden")
    document.getElementById("chatScreen").classList.remove("hidden")
    document.getElementById("startChatBtn").classList.remove("loading")
  }

  findPartner() {
    this.addSystemMessage("🔍 Buscando persona real disponible...", "connecting")

    const message = {
      type: "find_partner",
      userId: this.myId,
      mode: this.currentMode,
    }

    this.sendToServer(message)
  }

  findNewPartner() {
    this.disconnectFromPartner()

    // Clear messages
    document.getElementById("chatMessages").innerHTML = ""

    setTimeout(() => {
      this.findPartner()
    }, 1000)
  }

  disconnectFromPartner() {
    if (this.partnerId) {
      const message = {
        type: "disconnect",
        userId: this.myId,
        partnerId: this.partnerId,
      }

      this.sendToServer(message)
    }

    this.isConnected = false
    this.partnerId = null

    // Disable chat input
    document.getElementById("messageInput").disabled = true
    document.getElementById("sendBtn").disabled = true

    this.cleanupVideo()
  }

  sendMessage() {
    const messageInput = document.getElementById("messageInput")
    const text = messageInput.value.trim()

    if (!text || !this.isConnected || !this.partnerId) return

    const message = {
      type: "message",
      from: this.myId,
      to: this.partnerId,
      text: text,
    }

    this.sendToServer(message)
    this.addMessage(text, "own")
    messageInput.value = ""
  }

  async initializeVideo() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      const localVideo = document.getElementById("localVideo")
      localVideo.srcObject = this.localStream

      // Create peer connection for video
      await this.createPeerConnection()

      // Add local stream to peer connection
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream)
      })

      // Create and send offer
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)

      this.sendToServer({
        type: "offer",
        to: this.partnerId,
        offer: offer,
      })

      // Show video controls
      document.getElementById("toggleVideoBtn").classList.add("active")
      document.getElementById("toggleAudioBtn").classList.add("active")
    } catch (error) {
      console.error("Error accessing media devices:", error)
      this.addSystemMessage("No se pudo acceder a la cámara/micrófono", "disconnected")
    }
  }

  async createPeerConnection() {
    const configuration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    }

    this.peerConnection = new RTCPeerConnection(configuration)

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendToServer({
          type: "ice_candidate",
          to: this.partnerId,
          candidate: event.candidate,
        })
      }
    }

    this.peerConnection.ontrack = (event) => {
      const remoteVideo = document.getElementById("remoteVideo")
      remoteVideo.srcObject = event.streams[0]
      document.getElementById("videoPlaceholder").style.display = "none"
    }
  }

  cleanupVideo() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Reset video elements
    document.getElementById("localVideo").srcObject = null
    document.getElementById("remoteVideo").srcObject = null
    document.getElementById("videoPlaceholder").style.display = "flex"

    // Reset video controls
    document.getElementById("toggleVideoBtn").classList.remove("active")
    document.getElementById("toggleAudioBtn").classList.remove("active")
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        document.getElementById("toggleVideoBtn").classList.toggle("active")
      }
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        document.getElementById("toggleAudioBtn").classList.toggle("active")
      }
    }
  }

  addMessage(text, type) {
    const chatMessages = document.getElementById("chatMessages")
    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${type}`
    messageDiv.textContent = text

    chatMessages.appendChild(messageDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  addSystemMessage(text, status = "connecting") {
    const chatMessages = document.getElementById("chatMessages")
    const messageDiv = document.createElement("div")
    messageDiv.className = "system-message"
    messageDiv.innerHTML = `
      <span class="status-dot ${status}"></span>
      ${text}
    `

    chatMessages.appendChild(messageDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  updateConnectionStatus(status) {
    const statusIndicator = document.querySelector(".status-indicator")
    const statusText = document.querySelector(".status-text")

    statusIndicator.className = `status-indicator ${status}`

    switch (status) {
      case "online":
        statusText.textContent = "🟢 Conectado y listo"
        break
      case "offline":
        statusText.textContent = "🔴 Sin conexión"
        break
      case "connecting":
        statusText.textContent = "🟡 Conectando automáticamente..."
        break
    }
  }

  updateOnlineCount(count) {
    document.getElementById("onlineCount").textContent = count
  }

  sendToServer(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  generateUserId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  new AutoOmeChat()
})
