"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

const WELCOME_MESSAGES = [
  "¡Bienvenido a BRUTAL24! 🔥 Donde tus pensamientos viven rápido y mueren jóvenes",
  "¡La red social más HONESTA del universo! Sin filtros, sin mentiras, solo 24 horas de verdad",
  "¡Aquí puedes ser TÚ MISMO sin consecuencias! Todo desaparece como por arte de magia ✨",
  "¡BRUTAL24: Donde la autenticidad es KING y la falsedad está PROHIBIDA! 👑",
  "¡Comparte, conecta, desaparece! La fórmula perfecta para la libertad digital 🚀",
]

const CARTOON_AVATARS = [
  "https://api.dicebear.com/7.x/bottts/svg?seed=felix&backgroundColor=ffb3ba",
  "https://api.dicebear.com/7.x/bottts/svg?seed=aneka&backgroundColor=bae1ff",
  "https://api.dicebear.com/7.x/bottts/svg?seed=bob&backgroundColor=ffffba",
  "https://api.dicebear.com/7.x/bottts/svg?seed=charlie&backgroundColor=baffc9",
  "https://api.dicebear.com/7.x/bottts/svg?seed=diana&backgroundColor=ffdfba",
]

export function WelcomeBanner() {
  const [isVisible, setIsVisible] = useState(true)
  const [currentMessage, setCurrentMessage] = useState(0)
  const [hasSeenBanner, setHasSeenBanner] = useState(false)

  useEffect(() => {
    // Check if user has seen the banner before
    const seen = localStorage.getItem("brutal24_banner_seen")
    if (seen) {
      setHasSeenBanner(true)
      setIsVisible(false)
      return
    }

    // Cycle through messages
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % WELCOME_MESSAGES.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    localStorage.setItem("brutal24_banner_seen", "true")
    setHasSeenBanner(true)
  }

  if (!isVisible || hasSeenBanner) return null

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-chart-4 via-chart-1 to-chart-5 border-8 border-black shadow-brutal p-6 m-4 rounded-lg">
      {/* Floating cartoon characters */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {CARTOON_AVATARS.map((avatar, index) => (
          <img
            key={index}
            src={avatar || "/placeholder.svg"}
            alt={`Cartoon ${index + 1}`}
            className={`absolute w-16 h-16 opacity-20 animate-float`}
            style={{
              left: `${20 + index * 15}%`,
              top: `${10 + (index % 2) * 20}%`,
              animationDelay: `${index * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Sliding text banner */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white border-4 border-black shadow-brutal-light rounded-full flex items-center justify-center animate-bounce-slow">
              <span className="text-2xl">🎉</span>
            </div>
            <h2 className="text-2xl font-black text-white drop-shadow-lg">¡BRUTAL24!</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="bg-white/20 hover:bg-white/30 border-2 border-black text-black shadow-brutal-light btn-brutal"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Animated message */}
        <div className="bg-white/90 border-4 border-black shadow-brutal-medium rounded-lg p-4 mb-4">
          <p className="text-black font-bold text-lg text-center animate-wiggle">{WELCOME_MESSAGES[currentMessage]}</p>
        </div>

        {/* Features highlight */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/80 border-4 border-black shadow-brutal-light rounded-lg p-3 text-center hover-lift">
            <div className="text-2xl mb-1">⚡</div>
            <p className="text-xs font-bold text-black">24 HORAS</p>
          </div>
          <div className="bg-white/80 border-4 border-black shadow-brutal-light rounded-lg p-3 text-center hover-lift">
            <div className="text-2xl mb-1">🎭</div>
            <p className="text-xs font-bold text-black">ANÓNIMO</p>
          </div>
          <div className="bg-white/80 border-4 border-black shadow-brutal-light rounded-lg p-3 text-center hover-lift">
            <div className="text-2xl mb-1">🔥</div>
            <p className="text-xs font-bold text-black">BRUTAL</p>
          </div>
        </div>

        {/* Call to action */}
        <div className="mt-4 text-center">
          <Button
            onClick={handleClose}
            className="bg-white text-black border-4 border-black font-black px-6 py-2 btn-brutal hover:bg-gray-100"
          >
            ¡EMPEZAR A SER BRUTAL! 🚀
          </Button>
        </div>
      </div>

      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-full h-2 bg-white/30 animate-slide"></div>
      <div
        className="absolute bottom-0 right-0 w-full h-2 bg-white/30 animate-slide"
        style={{ animationDirection: "reverse" }}
      ></div>
    </div>
  )
}
