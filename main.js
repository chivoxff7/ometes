// Import necessary classes
import WebRTCManager from "./WebRTCManager"
import ContentModerationSystem from "./ContentModerationSystem"

class SafeChatApp {
  constructor() {
    this.webrtc = new WebRTCManager()
    this.moderation = new ContentModerationSystem()
    this.currentScreen = "welcome"
    this.isPremium = false
    this.userProfile = {}
    this.chatHistory = []
    this.connectionAttempts = 0
    this.maxConnectionAttempts = 3

    this.init()
  }

  async init() {
    await this.setupEventListeners()
    await this.loadMediaDevices()
    await this.moderation.loadModel()
    this.checkBanStatus()

    // Setup WebRTC callbacks
    this.webrtc.onRemoteStream = (stream) => {
      this.onRemoteStreamReceived(stream)
    }

    this.webrtc.onDataChannelMessage = (message) => {
      this.onMessageReceived(message)
    }

    this.webrtc.onConnectionStateChange = (state) => {
      this.updateConnectionStatus(state)
    }

    // Setup moderation callbacks
    this.moderation.onViolationDetected = (violation) => {
      this.onViolationDetected(violation)
    }

    this.moderation.onBanIssued = (banData) => {
      this.onBanIssued(banData)
    }
  }

  async setupEventListeners() {
    // Welcome screen events
    document.getElementById("startChatBtn").addEventListener("click", () => {
      this.startChat()
    })

    document.getElementById("togglePremiumBtn").addEventListener("click", () => {
      this.togglePremium()
    })

    // Chat screen events
    document.getElementById("toggleVideoBtn").addEventListener("click", () => {
      this.toggleVideo()
    })

    document.getElementById("toggleAudioBtn").addEventListener("click", () => {
      this.toggleAudio()
    })

    document.getElementById("nextBtn").addEventListener("click", () => {
      this.findNextPartner()
    })

    document.getElementById("endChatBtn").addEventListener("click", () => {
      this.endChat()
    })

    document.getElementById("reportBtn").addEventListener("click", () => {
      this.reportUser()
    })

    // Message input events
    document.getElementById("messageInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage()
      }
    })

    document.getElementById("sendBtn").addEventListener("click", () => {
      this.sendMessage()
    })

    // Ban screen events
    document.getElementById("backToWelcomeBtn").addEventListener("click", () => {
      this.showScreen("welcome")
    })
  }

  async loadMediaDevices() {
    try {
      const devices = await this.webrtc.getMediaDevices()

      const cameraSelect = document.getElementById("cameraSelect")
      const microphoneSelect = document.getElementById("microphoneSelect")

      // Populate camera options
      devices.cameras.forEach((camera, index) => {
        const option = document.createElement("option")
        option.value = camera.deviceId
        option.textContent = camera.label || `Cámara ${index + 1}`
        cameraSelect.appendChild(option)
      })

      // Populate microphone options
      devices.microphones.forEach((mic, index) => {
        const option = document.createElement("option")
        option.value = mic.deviceId
        option.textContent = mic.label || `Micrófono ${index + 1}`
        microphoneSelect.appendChild(option)
      })
    } catch (error) {
      console.error("Error loading media devices:", error)
      this.showNotification("Error accediendo a dispositivos de media", "error")
    }
  }

  checkBanStatus() {
    const activeBan = this.moderation.checkActiveBan()
    if (activeBan) {
      this.showBanScreen(activeBan)
      return true
    }
    return false
  }

  togglePremium() {
    this.isPremium = !this.isPremium
    const premiumFilters = document.getElementById("premiumFilters")
    const toggleBtn = document.getElementById("togglePremiumBtn")

    if (this.isPremium) {
      premiumFilters.style.display = "block"
      toggleBtn.textContent = "Desactivar Premium"
      toggleBtn.classList.add("btn-primary")
      toggleBtn.classList.remove("btn-secondary")
      this.showNotification("Premium activado - Filtros disponibles", "success")
    } else {
      premiumFilters.style.display = "none"
      toggleBtn.textContent = "Activar Premium"
      toggleBtn.classList.add("btn-secondary")
      toggleBtn.classList.remove("btn-primary")
      this.showNotification("Premium desactivado", "warning")
    }
  }

  async startChat() {
    if (this.checkBanStatus()) return

    try {
      // Collect user profile
      this.userProfile = {
        username: document.getElementById("username").value || "Anónimo",
        gender: document.getElementById("gender").value,
        lookingFor: document.getElementById("looking-for").value,
        ageFilter: this.isPremium ? document.getElementById("ageFilter").value : "",
        countryFilter: this.isPremium ? document.getElementById("countryFilter").value : "",
        interests: this.isPremium ? document.getElementById("interestFilter").value : "",
      }

      // Initialize media
      const cameraId = document.getElementById("cameraSelect").value
      const micId = document.getElementById("microphoneSelect").value

      await this.webrtc.initializeMedia(cameraId || null, micId || null)

      this.showScreen("chat")
      this.showNotification("Buscando compañero de chat...", "success")

      // Start moderation monitoring
      const localVideo = document.getElementById("localVideo")
      this.moderation.startMonitoring(localVideo)

      // Simulate finding a partner (in real implementation, this would connect to a signaling server)
      setTimeout(() => {
        this.simulatePartnerConnection()
      }, 2000)
    } catch (error) {
      console.error("Error starting chat:", error)
      this.showNotification("Error iniciando chat. Verifica permisos de cámara y micrófono.", "error")
    }
  }

  simulatePartnerConnection() {
    // This is a simulation - in a real app, you'd connect to a signaling server
    const partnerInfo = this.generateRandomPartner()
    document.getElementById("partnerInfo").textContent =
      `${partnerInfo.username} (${partnerInfo.gender || "No especificado"})`

    this.updateConnectionStatus("connected")
    this.addSystemMessage(`Conectado con ${partnerInfo.username}`)

    // Simulate some incoming messages
    setTimeout(() => {
      this.onMessageReceived({
        type: "text",
        content: "¡Hola! ¿Cómo estás?",
        timestamp: Date.now(),
      })
    }, 3000)
  }

  generateRandomPartner() {
    const names = ["Alex", "Sam", "Jordan", "Casey", "Riley", "Avery"]
    const genders = ["Hombre", "Mujer", "No binario"]

    return {
      username: names[Math.floor(Math.random() * names.length)],
      gender: genders[Math.floor(Math.random() * genders.length)],
    }
  }

  toggleVideo() {
    const isEnabled = this.webrtc.toggleVideo()
    const btn = document.getElementById("toggleVideoBtn")

    if (isEnabled) {
      btn.classList.add("active")
      btn.textContent = "📹"
    } else {
      btn.classList.remove("active")
      btn.textContent = "📹❌"
    }
  }

  toggleAudio() {
    const isEnabled = this.webrtc.toggleAudio()
    const btn = document.getElementById("toggleAudioBtn")

    if (isEnabled) {
      btn.classList.add("active")
      btn.textContent = "🎤"
    } else {
      btn.classList.remove("active")
      btn.textContent = "🎤❌"
    }
  }

  sendMessage() {
    const input = document.getElementById("messageInput")
    const message = input.value.trim()

    if (!message) return

    const messageData = {
      type: "text",
      content: message,
      timestamp: Date.now(),
    }

    // Add to local chat
    this.addMessage(messageData, true)

    // Send via WebRTC (in simulation, we just echo it back)
    if (this.webrtc.isConnected) {
      this.webrtc.sendMessage(messageData)
    }

    input.value = ""

    // Simulate response (remove in real implementation)
    setTimeout(
      () => {
        const responses = [
          "Interesante punto de vista",
          "¿En serio? Cuéntame más",
          "Jaja, eso es divertido",
          "No estoy seguro de eso",
          "¿Qué opinas sobre...?",
        ]

        this.onMessageReceived({
          type: "text",
          content: responses[Math.floor(Math.random() * responses.length)],
          timestamp: Date.now(),
        })
      },
      1000 + Math.random() * 3000,
    )
  }

  onMessageReceived(messageData) {
    this.addMessage(messageData, false)
  }

  addMessage(messageData, isSent) {
    const messagesContainer = document.getElementById("chatMessages")
    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${isSent ? "sent" : "received"}`
    messageDiv.textContent = messageData.content

    messagesContainer.appendChild(messageDiv)
    messagesContainer.scrollTop = messagesContainer.scrollHeight

    // Store in chat history
    this.chatHistory.push({
      ...messageData,
      isSent,
    })
  }

  addSystemMessage(content) {
    const messagesContainer = document.getElementById("chatMessages")
    const messageDiv = document.createElement("div")
    messageDiv.className = "message system"
    messageDiv.textContent = content

    messagesContainer.appendChild(messageDiv)
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  findNextPartner() {
    this.showNotification("Buscando nuevo compañero...", "success")
    this.clearChat()

    // Simulate finding new partner
    setTimeout(() => {
      this.simulatePartnerConnection()
    }, 1500)
  }

  endChat() {
    this.webrtc.disconnect()
    this.moderation.stopMonitoring()
    this.showScreen("welcome")
    this.clearChat()
    this.showNotification("Chat terminado", "success")
  }

  clearChat() {
    const messagesContainer = document.getElementById("chatMessages")
    messagesContainer.innerHTML = ""
    this.chatHistory = []
    document.getElementById("partnerInfo").textContent = "Desconectado"
    this.updateConnectionStatus("disconnected")
  }

  reportUser() {
    // In a real implementation, this would send a report to the server
    this.showNotification("Usuario reportado. Gracias por mantener la comunidad segura.", "success")
    this.findNextPartner()
  }

  updateConnectionStatus(state) {
    const statusElement = document.getElementById("connectionStatus")
    const statusDot = statusElement.querySelector(".status-dot")
    const statusText = statusElement.querySelector("span:last-child")

    switch (state) {
      case "connected":
        statusDot.classList.add("connected")
        statusText.textContent = "Conectado"
        break
      case "connecting":
        statusDot.classList.remove("connected")
        statusText.textContent = "Conectando..."
        break
      default:
        statusDot.classList.remove("connected")
        statusText.textContent = "Desconectado"
    }
  }

  onRemoteStreamReceived(stream) {
    // Start monitoring remote video for content moderation
    const remoteVideo = document.getElementById("remoteVideo")
    if (remoteVideo) {
      // Note: In a real implementation, you might want to monitor remote video too
      // but this requires careful consideration of privacy and legal implications
    }
  }

  onViolationDetected(violation) {
    this.showNotification(`Contenido inapropiado detectado. Tipo: ${violation.type}`, "warning")
  }

  onBanIssued(banData) {
    this.webrtc.disconnect()
    this.moderation.stopMonitoring()
    this.showBanScreen(banData)
  }

  showBanScreen(banData) {
    const banMessage = document.getElementById("banMessage")
    const banTimer = document.getElementById("banTimer")

    banMessage.textContent = banData.message

    if (banData.duration === Number.POSITIVE_INFINITY) {
      banTimer.textContent = "Ban Permanente"
    } else {
      this.startBanTimer(banData)
    }

    this.showScreen("ban")
  }

  startBanTimer(banData) {
    const banTimer = document.getElementById("banTimer")

    const updateTimer = () => {
      const remaining = this.moderation.getRemainingBanTime()

      if (remaining <= 0) {
        this.showScreen("welcome")
        this.showNotification("Ban expirado. Puedes usar la plataforma nuevamente.", "success")
        return
      }

      const minutes = Math.floor(remaining / (1000 * 60))
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000)

      banTimer.textContent = `Tiempo restante: ${minutes}:${seconds.toString().padStart(2, "0")}`
    }

    updateTimer()
    const timerInterval = setInterval(updateTimer, 1000)

    // Clear interval when ban expires
    setTimeout(() => {
      clearInterval(timerInterval)
    }, this.moderation.getRemainingBanTime())
  }

  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active")
    })

    // Show target screen
    document.getElementById(`${screenName}Screen`).classList.add("active")
    this.currentScreen = screenName
  }

  showNotification(message, type = "info") {
    const notificationsContainer = document.getElementById("notifications")
    const notification = document.createElement("div")
    notification.className = `notification ${type}`
    notification.textContent = message

    notificationsContainer.appendChild(notification)

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 5000)
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.safeChatApp = new SafeChatApp()

  // Add some developer tools for testing
  window.testViolation = () => {
    window.safeChatApp.moderation.simulateViolation("explicit")
  }

  window.clearBans = () => {
    window.safeChatApp.moderation.clearViolationHistory()
    console.log("Historial de violaciones limpiado")
  }
})
