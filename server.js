// SERVIDOR WEBSOCKET PARA CONEXIONES REALES
// Ejecutar con: node server.js

const WebSocket = require("ws")
const http = require("http")

class OmeChatServer {
  constructor() {
    this.users = new Map() // userId -> { ws, mode, partnerId }
    this.waitingUsers = new Map() // mode -> [userIds]
    this.server = null
    this.wss = null

    this.init()
  }

  init() {
    // Crear servidor HTTP
    this.server = http.createServer()

    // Crear servidor WebSocket
    this.wss = new WebSocket.Server({
      server: this.server,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })

    this.wss.on("connection", (ws) => {
      console.log("Nueva conexión WebSocket")

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data)
          this.handleMessage(ws, message)
        } catch (error) {
          console.error("Error parsing message:", error)
        }
      })

      ws.on("close", () => {
        this.handleDisconnection(ws)
      })

      ws.on("error", (error) => {
        console.error("WebSocket error:", error)
      })
    })

    // Iniciar servidor
    const PORT = process.env.PORT || 3000
    this.server.listen(PORT, () => {
      console.log(`🚀 OmeChat Server running on port ${PORT}`)
      console.log(`📡 WebSocket URL: ws://localhost:${PORT}`)
    })

    // Broadcast user count every 5 seconds
    setInterval(() => {
      this.broadcastUserCount()
    }, 5000)
  }

  handleMessage(ws, message) {
    console.log("Mensaje recibido:", message.type)

    switch (message.type) {
      case "register":
        this.registerUser(ws, message)
        break
      case "find_partner":
        this.findPartner(message.userId)
        break
      case "message":
        this.relayMessage(message)
        break
      case "disconnect":
        this.disconnectUsers(message.userId, message.partnerId)
        break
      case "offer":
      case "answer":
      case "ice_candidate":
        this.relayWebRTCMessage(message)
        break
    }
  }

  registerUser(ws, message) {
    const { userId, mode } = message

    this.users.set(userId, {
      ws: ws,
      mode: mode,
      partnerId: null,
    })

    // Initialize waiting list for mode if doesn't exist
    if (!this.waitingUsers.has(mode)) {
      this.waitingUsers.set(mode, [])
    }

    ws.send(
      JSON.stringify({
        type: "registered",
        userId: userId,
      }),
    )

    console.log(`Usuario registrado: ${userId} (${mode})`)
    this.broadcastUserCount()
  }

  findPartner(userId) {
    const user = this.users.get(userId)
    if (!user) return

    const { mode } = user
    const waitingList = this.waitingUsers.get(mode) || []

    // Remove user from waiting list if already there
    const userIndex = waitingList.indexOf(userId)
    if (userIndex > -1) {
      waitingList.splice(userIndex, 1)
    }

    // Try to find a partner
    if (waitingList.length > 0) {
      // Match with first waiting user
      const partnerId = waitingList.shift()
      const partner = this.users.get(partnerId)

      if (partner && partner.partnerId === null) {
        // Create connection
        user.partnerId = partnerId
        partner.partnerId = userId

        // Notify both users
        user.ws.send(
          JSON.stringify({
            type: "partner_found",
            partnerId: partnerId,
          }),
        )

        partner.ws.send(
          JSON.stringify({
            type: "partner_found",
            partnerId: userId,
          }),
        )

        console.log(`Conexión establecida: ${userId} <-> ${partnerId}`)
      } else {
        // Partner no longer available, add user to waiting list
        waitingList.push(userId)
      }
    } else {
      // No partners available, add to waiting list
      waitingList.push(userId)
      console.log(`Usuario ${userId} esperando pareja en modo ${mode}`)
    }

    this.waitingUsers.set(mode, waitingList)
  }

  relayMessage(message) {
    const { from, to, text } = message
    const recipient = this.users.get(to)

    if (recipient) {
      recipient.ws.send(
        JSON.stringify({
          type: "message",
          from: from,
          text: text,
        }),
      )
    }
  }

  relayWebRTCMessage(message) {
    const { to } = message
    const recipient = this.users.get(to)

    if (recipient) {
      recipient.ws.send(JSON.stringify(message))
    }
  }

  disconnectUsers(userId, partnerId) {
    const user = this.users.get(userId)
    const partner = this.users.get(partnerId)

    if (user) {
      user.partnerId = null
    }

    if (partner) {
      partner.partnerId = null
      partner.ws.send(
        JSON.stringify({
          type: "partner_disconnected",
        }),
      )
    }

    console.log(`Usuarios desconectados: ${userId} <-> ${partnerId}`)
  }

  handleDisconnection(ws) {
    // Find and remove user
    let disconnectedUserId = null

    for (const [userId, userData] of this.users.entries()) {
      if (userData.ws === ws) {
        disconnectedUserId = userId

        // Disconnect from partner if exists
        if (userData.partnerId) {
          this.disconnectUsers(userId, userData.partnerId)
        }

        // Remove from waiting lists
        for (const [mode, waitingList] of this.waitingUsers.entries()) {
          const index = waitingList.indexOf(userId)
          if (index > -1) {
            waitingList.splice(index, 1)
          }
        }

        this.users.delete(userId)
        break
      }
    }

    if (disconnectedUserId) {
      console.log(`Usuario desconectado: ${disconnectedUserId}`)
      this.broadcastUserCount()
    }
  }

  broadcastUserCount() {
    const count = this.users.size
    const message = JSON.stringify({
      type: "user_count",
      count: count,
    })

    this.users.forEach((userData) => {
      if (userData.ws.readyState === WebSocket.OPEN) {
        userData.ws.send(message)
      }
    })
  }
}

// Iniciar servidor
new OmeChatServer()
