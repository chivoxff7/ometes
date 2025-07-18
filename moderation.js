import nsfwjs from "nsfwjs"

class ContentModerationSystem {
  constructor() {
    this.model = null
    this.isModelLoaded = false
    this.moderationCanvas = document.getElementById("moderationCanvas")
    this.moderationContext = this.moderationCanvas.getContext("2d")
    this.checkInterval = null
    this.violations = this.getViolationHistory()

    this.thresholds = {
      nsfw: 0.7,
      explicit: 0.8,
    }

    this.banDurations = {
      first: 5 * 60 * 1000, // 5 minutos
      second: 30 * 60 * 1000, // 30 minutos
      third: Number.POSITIVE_INFINITY, // Permanente
    }

    this.onViolationDetected = null
    this.onBanIssued = null
  }

  async loadModel() {
    try {
      console.log("Cargando modelo de moderación...")
      this.model = await nsfwjs.load()
      this.isModelLoaded = true
      console.log("Modelo de moderación cargado exitosamente")
      return true
    } catch (error) {
      console.error("Error cargando modelo de moderación:", error)
      return false
    }
  }

  startMonitoring(videoElement) {
    if (!this.isModelLoaded) {
      console.warn("Modelo de moderación no está cargado")
      return
    }

    this.stopMonitoring()

    this.checkInterval = setInterval(async () => {
      await this.analyzeFrame(videoElement)
    }, 2000) // Analizar cada 2 segundos
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  async analyzeFrame(videoElement) {
    if (!videoElement || !this.model || videoElement.videoWidth === 0) {
      return
    }

    try {
      // Configurar canvas para capturar frame
      this.moderationCanvas.width = videoElement.videoWidth
      this.moderationCanvas.height = videoElement.videoHeight

      // Dibujar frame actual en canvas
      this.moderationContext.drawImage(videoElement, 0, 0, this.moderationCanvas.width, this.moderationCanvas.height)

      // Analizar contenido
      const predictions = await this.model.classify(this.moderationCanvas)
      await this.processPredictions(predictions)
    } catch (error) {
      console.error("Error analizando frame:", error)
    }
  }

  async processPredictions(predictions) {
    const explicitContent = predictions.find(
      (p) => (p.className === "Porn" || p.className === "Hentai") && p.probability > this.thresholds.explicit,
    )

    const nsfwContent = predictions.find((p) => p.className === "Sexy" && p.probability > this.thresholds.nsfw)

    if (explicitContent) {
      await this.handleViolation("explicit", explicitContent.probability)
    } else if (nsfwContent) {
      await this.handleViolation("nsfw", nsfwContent.probability)
    }
  }

  async handleViolation(type, confidence) {
    console.log(`Violación detectada: ${type} (confianza: ${confidence.toFixed(2)})`)

    const violation = {
      type,
      confidence,
      timestamp: Date.now(),
    }

    this.violations.push(violation)
    this.saveViolationHistory()

    if (this.onViolationDetected) {
      this.onViolationDetected(violation)
    }

    // Determinar tipo de ban basado en historial
    const banInfo = this.determineBan()
    if (banInfo) {
      await this.issueBan(banInfo)
    }
  }

  determineBan() {
    const recentViolations = this.violations.filter(
      (v) => Date.now() - v.timestamp < 24 * 60 * 60 * 1000, // Últimas 24 horas
    )

    const violationCount = recentViolations.length

    if (violationCount === 1) {
      return {
        type: "first",
        duration: this.banDurations.first,
        message: "Primera advertencia: Contenido inapropiado detectado. Ban temporal de 5 minutos.",
      }
    } else if (violationCount === 2) {
      return {
        type: "second",
        duration: this.banDurations.second,
        message: "Segunda advertencia: Ban temporal de 30 minutos. Una tercera ofensa resultará en ban permanente.",
      }
    } else if (violationCount >= 3) {
      return {
        type: "permanent",
        duration: this.banDurations.third,
        message: "Tercera ofensa: Ban permanente de la plataforma.",
      }
    }

    return null
  }

  async issueBan(banInfo) {
    const banData = {
      ...banInfo,
      startTime: Date.now(),
      endTime: banInfo.duration === Number.POSITIVE_INFINITY ? null : Date.now() + banInfo.duration,
    }

    // Guardar información del ban
    localStorage.setItem("currentBan", JSON.stringify(banData))

    if (this.onBanIssued) {
      this.onBanIssued(banData)
    }

    console.log(`Ban emitido: ${banInfo.type}`, banData)
  }

  checkActiveBan() {
    const banData = localStorage.getItem("currentBan")
    if (!banData) return null

    const ban = JSON.parse(banData)

    // Si es ban permanente
    if (ban.duration === Number.POSITIVE_INFINITY) {
      return ban
    }

    // Si el ban temporal ha expirado
    if (Date.now() > ban.endTime) {
      localStorage.removeItem("currentBan")
      return null
    }

    return ban
  }

  getRemainingBanTime() {
    const ban = this.checkActiveBan()
    if (!ban) return 0

    if (ban.duration === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY

    return Math.max(0, ban.endTime - Date.now())
  }

  getViolationHistory() {
    const history = localStorage.getItem("violationHistory")
    return history ? JSON.parse(history) : []
  }

  saveViolationHistory() {
    localStorage.setItem("violationHistory", JSON.stringify(this.violations))
  }

  clearViolationHistory() {
    this.violations = []
    localStorage.removeItem("violationHistory")
    localStorage.removeItem("currentBan")
  }

  // Método para testing - simular violación
  simulateViolation(type = "explicit") {
    this.handleViolation(type, 0.9)
  }
}
