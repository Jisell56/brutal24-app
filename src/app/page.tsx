"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  Heart,
  MessageCircle,
  Search,
  Plus,
  Clock,
  X,
  Send,
  Home,
  User,
  ArrowLeft,
  Reply,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react"
import { getAnonymousUser, getUserLikes, syncLikesToSupabase } from "@/lib/user-storage"
import Confetti from "canvas-confetti"
import Image from "next/image"

interface Post {
  id: string
  user_id: string
  username: string
  content: string
  image_url?: string
  likes_count: number
  comments_count: number
  created_at: string
  expires_at: string
  user_has_liked?: boolean
}

interface Comment {
  id: string
  post_id: string
  user_id: string
  username: string
  content: string
  created_at: string
  parent_id?: string
}

interface UserType {
  id: string
  username: string
  created_at: string
}

const AVATAR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFD166",
  "#FF8C42",
  "#6A0572",
  "#1A936F",
  "#3D5A80",
  "#FF70A6",
  "#E76F51",
  "#9B5DE5",
]

const AVATAR_CHARACTERS = [
  "🦄",
  "🐙",
  "🦊",
  "🐸",
  "🦜",
  "🦖",
  "🐳",
  "🦁",
  "🐯",
  "🐵",
  "🐹",
  "🐰",
  "🦝",
  "🐨",
  "🐼",
  "🐻",
  "🐶",
  "🐱",
  "🐮",
  "🐷",
]

const generateRandomAvatar = (username: string) => {
  const seed = username.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colorIndex = seed % AVATAR_COLORS.length
  const characterIndex = seed % AVATAR_CHARACTERS.length

  return {
    color: AVATAR_COLORS[colorIndex],
    character: AVATAR_CHARACTERS[characterIndex],
  }
}

export default function Brutal24App() {
  const [activeTab, setActiveTab] = useState<"feed" | "search" | "create" | "profile">("feed")
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [newPost, setNewPost] = useState("")
  const [selectedPost, setSelectedPost] = useState<string | null>(null)
  const [newComment, setNewComment] = useState("")
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set())
  const [commentingPosts, setCommentingPosts] = useState<Set<string>>(new Set())
  const [user, setUser] = useState<UserType | null>(null)
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set())
  const [avatarCache, setAvatarCache] = useState<Record<string, { color: string; character: string }>>({})
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [isInitialized, setIsInitialized] = useState(false)

  const confettiRef = useRef<HTMLDivElement>(null)
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Función para cargar posts - sin dependencias circulares
  const loadPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error("Error fetching posts:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las publicaciones",
        variant: "destructive",
      })
      return []
    }
  }, [supabase, toast])

  // Función para actualizar posts con estado de likes
  const updatePostsWithLikes = useCallback((postsData: Post[], likes: Set<string>) => {
    return postsData.map((post) => ({
      ...post,
      user_has_liked: likes.has(post.id),
    }))
  }, [])

  // Función para cargar posts y aplicar likes
  const fetchPosts = useCallback(async () => {
    const postsData = await loadPosts()
    const postsWithLikes = updatePostsWithLikes(postsData, userLikes)
    setPosts(postsWithLikes)
  }, [loadPosts, updatePostsWithLikes, userLikes])

  // Configurar suscripciones en tiempo real
  const setupRealtimeSubscriptions = useCallback(() => {
    const postsSubscription = supabase
      .channel("posts_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        const newPost = payload.new as Post
        setPosts((prev) => [newPost, ...prev])
        showNotification("¡Nueva publicación!", `${newPost.username} ha compartido algo nuevo`)
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        setPosts((prev) => prev.filter((post) => post.id !== payload.old.id))
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, (payload) => {
        const updatedPost = payload.new as Post
        setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? updatedPost : post)))
      })
      .subscribe()

    const commentsSubscription = supabase
      .channel("comments_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
        const newComment = payload.new as Comment
        if (selectedPost === newComment.post_id) {
          fetchComments(newComment.post_id)
        }
        showNotification("¡Nuevo comentario!", "Alguien ha comentado en una publicación")
      })
      .subscribe()

    return () => {
      postsSubscription.unsubscribe()
      commentsSubscription.unsubscribe()
    }
  }, [supabase, selectedPost])

  // Inicializar app - solo una vez
  const initializeApp = useCallback(async () => {
    if (isInitialized) return

    try {
      setIsInitialized(true)

      const anonymousUser = await getAnonymousUser()
      setUser(anonymousUser)

      const likes = await getUserLikes(anonymousUser.id)
      setUserLikes(likes)

      // Cargar posts después de tener los likes
      const postsData = await loadPosts()
      const postsWithLikes = updatePostsWithLikes(postsData, likes)
      setPosts(postsWithLikes)

      setupRealtimeSubscriptions()
    } catch (error) {
      console.error("Error initializing app:", error)
      setIsInitialized(false)
    }
  }, [isInitialized, loadPosts, updatePostsWithLikes, setupRealtimeSubscriptions])

  useEffect(() => {
    initializeApp()
  }, [initializeApp])

  const showNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/icon-192x192.png",
        tag: "brutal24-notification",
      })
    }
  }

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission()
    }
  }

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at")

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error("Error fetching comments:", error)
    }
  }

  const triggerConfetti = () => {
    if (confettiRef.current) {
      const rect = confettiRef.current.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2

      Confetti({
        particleCount: 100,
        spread: 70,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
        colors: AVATAR_COLORS,
        disableForReducedMotion: true,
      })
    }
  }

  const createPost = async () => {
    if (!newPost.trim() || !user?.id) return

    setLoading(true)
    try {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      const postData = {
        user_id: user.id,
        username: user.username,
        content: newPost,
        expires_at: expiresAt.toISOString(),
        likes_count: 0,
        comments_count: 0,
      }

      const { error } = await supabase.from("posts").insert(postData).select()

      if (error) {
        throw error
      }

      setNewPost("")
      setActiveTab("feed")

      setTimeout(() => {
        triggerConfetti()
      }, 300)

      toast({
        title: "¡Éxito!",
        description: "Tu publicación ha sido creada y desaparecerá en 24 horas",
      })

      // Recargar posts después de crear uno nuevo
      await fetchPosts()
    } catch (error: unknown) {
      console.error("Error creating post:", error)
      const message = error instanceof Error ? error.message : "No se pudo crear la publicación. Inténtalo de nuevo."
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Función de like optimizada para evitar bloqueos
  const toggleLike = useCallback(
    async (postId: string) => {
      if (!user?.id || likingPosts.has(postId)) return

      // Prevenir múltiples clicks
      setLikingPosts((prev) => new Set(prev).add(postId))

      try {
        const post = posts.find((p) => p.id === postId)
        if (!post) return

        const hasLiked = userLikes.has(postId)
        const newLikes = new Set(userLikes)
        let newLikesCount: number

        if (hasLiked) {
          // Unlike
          newLikes.delete(postId)
          newLikesCount = Math.max(0, post.likes_count - 1)
        } else {
          // Like
          newLikes.add(postId)
          newLikesCount = post.likes_count + 1
        }

        // Actualización optimista de UI
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, user_has_liked: !hasLiked, likes_count: newLikesCount } : p)),
        )

        // Actualizar estado local de likes inmediatamente
        setUserLikes(newLikes)

        // Actualizar base de datos
        const { error } = await supabase.from("posts").update({ likes_count: newLikesCount }).eq("id", postId)

        if (error) throw error

        // Sincronizar con Supabase en segundo plano
        await syncLikesToSupabase(user.id, newLikes)
      } catch (error) {
        console.error("Error toggling like:", error)
        toast({
          title: "Error",
          description: "No se pudo actualizar el me gusta",
          variant: "destructive",
        })

        // Revertir cambios en caso de error
        await fetchPosts()
      } finally {
        // Siempre liberar el bloqueo
        setLikingPosts((prev) => {
          const newSet = new Set(prev)
          newSet.delete(postId)
          return newSet
        })
      }
    },
    [user?.id, userLikes, posts, supabase, toast, likingPosts, fetchPosts],
  )

  const addComment = async (postId: string) => {
    if (!newComment.trim() || !user?.id || commentingPosts.has(postId)) return

    setCommentingPosts((prev) => new Set(prev).add(postId))

    try {
      const commentData = {
        post_id: postId,
        user_id: user.id,
        username: user.username,
        content: newComment,
        ...(replyingTo && { parent_id: replyingTo.id }),
      }

      const { error } = await supabase.from("comments").insert(commentData).select().single()

      if (error) throw error

      setNewComment("")
      setReplyingTo(null)
      await fetchComments(postId)

      // Actualizar contador de comentarios en el post
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post)),
      )

      toast({
        title: "¡Comentario añadido!",
        description: replyingTo ? "Tu respuesta ha sido publicada" : "Tu comentario ha sido publicado",
      })
    } catch (error) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error",
        description: "No se pudo añadir el comentario. Inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setCommentingPosts((prev) => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  const getTimeLeft = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()

    if (diff <= 0) return "Expirado"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}h ${minutes}m`
  }

  const getAvatar = (username: string) => {
    if (!avatarCache[username]) {
      const newAvatar = generateRandomAvatar(username)
      setAvatarCache((prev) => ({ ...prev, [username]: newAvatar }))
      return newAvatar
    }
    return avatarCache[username]
  }

  const toggleExpandPost = (postId: string) => {
    setExpandedPosts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const filteredPosts = posts.filter(
    (post) =>
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date().toISOString()
      await supabase.from("posts").delete().lt("expires_at", now)
      setPosts((prev) => prev.filter((post) => post.expires_at > now))
    }, 60000)

    return () => clearInterval(interval)
  }, [supabase])

  useEffect(() => {
    const handleFirstInteraction = () => {
      requestNotificationPermission()
      document.removeEventListener("click", handleFirstInteraction)
    }
    document.addEventListener("click", handleFirstInteraction)
    return () => document.removeEventListener("click", handleFirstInteraction)
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center p-4">
          <h1 className="text-3xl md:text-4xl font-black mb-4">BRUTAL24</h1>
          <p className="text-lg md:text-xl font-bold">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-bold">
      <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-50"></div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[var(--secondary-background)] border-b-8 border-[var(--border)] p-4 shadow-[8px_8px_0px_0px_var(--border)]">
        <div className="flex items-center justify-between">
          {activeTab === "profile" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveTab("feed")}
                className="bg-[var(--chart-5)] hover:bg-[var(--chart-5-dark)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] text-black hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all"
              >
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <h1 className="text-xl md:text-2xl font-black text-[var(--foreground)] tracking-tight truncate max-w-[120px]">
                TU PERFIL
              </h1>
            </div>
          ) : (
            <h1 className="text-2xl md:text-3xl font-black text-[var(--foreground)] tracking-tight">BRUTAL24</h1>
          )}

          {activeTab !== "profile" && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="bg-[var(--chart-2)] hover:bg-[var(--chart-2-dark)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] text-white hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all"
                onClick={() => setActiveTab("profile")}
              >
                <User className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="pb-24">
        {activeTab === "feed" && (
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="p-4 space-y-6">
              {posts.length === 0 ? (
                <Card className="bg-[var(--chart-5)] border-8 border-[var(--border)] shadow-[12px_12px_0px_0px_var(--border)] text-center p-4">
                  <h2 className="text-lg md:text-xl font-black mb-2">¡No hay publicaciones aún!</h2>
                  <p className="text-base font-bold mb-4">¡Sé el primero en compartir algo brutal!</p>
                  <Button
                    onClick={() => setActiveTab("create")}
                    className="bg-[var(--chart-3)] hover:bg-[var(--chart-3-dark)] border-4 border-[var(--border)] text-white font-black text-base px-4 py-3 shadow-[4px_4px_0px_0px_var(--border)] hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all"
                  >
                    CREAR PRIMERA PUBLICACIÓN
                  </Button>
                </Card>
              ) : (
                posts.map((post) => {
                  const avatar = getAvatar(post.username)
                  const isExpanded = expandedPosts.has(post.id)

                  return (
                    <Card
                      key={post.id}
                      className="bg-[var(--secondary-background)] border-8 border-[var(--border)] shadow-[12px_12px_0px_0px_var(--border)] hover:shadow-[8px_8px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all duration-200"
                    >
                      <CardHeader className="pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] w-10 h-10">
                              <AvatarFallback
                                style={{ backgroundColor: avatar.color }}
                                className="text-black font-black text-base"
                              >
                                {avatar.character}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-[var(--foreground)] font-black text-base truncate max-w-[100px] md:max-w-none">
                                @{post.username}
                              </p>
                              <p className="text-[var(--foreground)] opacity-70 text-xs font-bold">
                                {new Date(post.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-0 sm:self-end">
                            <Badge className="bg-[var(--chart-4)] text-white font-black border-4 border-[var(--border)] shadow-[2px_2px_0px_0px_var(--border)] text-xs px-2 py-0.5">
                              <Clock className="h-3 w-3 mr-1" />
                              {getTimeLeft(post.expires_at)}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="relative">
                          <p
                            className={`text-[var(--foreground)] leading-relaxed text-base font-bold ${!isExpanded && "line-clamp-3"}`}
                          >
                            {post.content}
                          </p>
                          {post.content.length > 150 && (
                            <button
                              onClick={() => toggleExpandPost(post.id)}
                              className="mt-1 bg-[var(--chart-1)] text-white font-bold px-2 py-1 border-2 border-[var(--border)] shadow-[2px_2px_0px_0px_var(--border)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-xs"
                            >
                              {isExpanded ? (
                                <span className="flex items-center gap-1">
                                  <ChevronUp className="h-3 w-3" /> Ver menos
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <ChevronDown className="h-3 w-3" /> Leer más
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                        {post.image_url && (
                          <div className="border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] overflow-hidden">
                            <Image
                              src={post.image_url || "/placeholder.svg"}
                              alt="Post content"
                              width={500}
                              height={300}
                              className="w-full h-auto"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-3 pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={likingPosts.has(post.id)}
                            className={`${
                              post.user_has_liked
                                ? "bg-[var(--chart-4)] text-white border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)]"
                                : "bg-[var(--secondary-background)] text-[var(--foreground)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:bg-red-100"
                            } font-black text-base px-4 py-2 hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50`}
                            onClick={() => toggleLike(post.id)}
                          >
                            <Heart
                              className={`h-4 w-4 mr-2 ${post.user_has_liked ? "fill-current text-red-500" : ""}`}
                            />
                            {post.likes_count}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="bg-[var(--chart-3)] text-white hover:bg-[var(--chart-3-dark)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] font-black text-base px-4 py-2 hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all"
                            onClick={() => {
                              setSelectedPost(post.id)
                              fetchComments(post.id)
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            {post.comments_count}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === "search" && (
          <div className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 md:h-5 md:w-5 text-[var(--foreground)]" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-3 bg-[var(--secondary-background)] border-6 border-[var(--border)] text-[var(--foreground)] placeholder-gray-500 font-bold text-base h-12 shadow-[6px_6px_0px_0px_var(--border)] focus:shadow-[4px_4px_0px_0px_var(--border)] focus:translate-x-1 focus:translate-y-1 transition-all"
              />
            </div>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-4">
                {filteredPosts.length === 0 ? (
                  <Card className="bg-[var(--chart-5)] border-6 border-[var(--border)] shadow-[6px_6px_0px_0px_var(--border)] text-center p-4">
                    <h2 className="text-base font-black mb-1">No se encontraron resultados</h2>
                    <p className="text-sm font-bold">¡Intenta buscar otra cosa!</p>
                  </Card>
                ) : (
                  filteredPosts.map((post) => {
                    const avatar = getAvatar(post.username)
                    const isExpanded = expandedPosts.has(post.id)

                    return (
                      <Card
                        key={post.id}
                        className="bg-[var(--chart-5)] border-6 border-[var(--border)] shadow-[6px_6px_0px_0px_var(--border)] hover:shadow-[4px_4px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedPost(post.id)
                          fetchComments(post.id)
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar className="border-2 border-[var(--border)] w-8 h-8">
                              <AvatarFallback
                                style={{ backgroundColor: avatar.color }}
                                className="text-black font-black text-sm"
                              >
                                {avatar.character}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-[var(--foreground)] font-black text-base truncate max-w-[100px]">
                                @{post.username}
                              </p>
                              <div className="text-[var(--foreground)] opacity-70 text-xs font-bold flex items-center gap-1">
                                <span>
                                  {new Date(post.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <Badge className="bg-[var(--chart-4)] text-white font-black border-2 border-[var(--border)] shadow-[1px_1px_0px_0px_var(--border)] text-2xs px-1.5 py-0.5">
                                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                                  {getTimeLeft(post.expires_at)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="relative">
                            <p
                              className={`text-[var(--foreground)] font-bold text-sm ${!isExpanded ? "line-clamp-2" : ""}`}
                            >
                              {post.content}
                            </p>
                            {post.content.length > 100 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpandPost(post.id)
                                }}
                                className="mt-1 bg-[var(--chart-1)] text-white font-bold px-2 py-0.5 border-2 border-[var(--border)] shadow-[2px_2px_0px_0px_var(--border)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-2xs"
                              >
                                {isExpanded ? (
                                  <span className="flex items-center gap-1">
                                    <ChevronUp className="h-2.5 w-2.5" /> Ver menos
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <ChevronDown className="h-2.5 w-2.5" /> Leer más
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {activeTab === "create" && (
          <div className="p-4 space-y-6">
            <Card className="bg-[var(--chart-1)] border-8 border-[var(--border)] shadow-[12px_12px_0px_0px_var(--border)]">
              <CardHeader>
                <h2 className="text-xl font-black text-[var(--foreground)]">CREAR PUBLICACIÓN</h2>
                <p className="text-[var(--foreground)] opacity-70 font-bold text-sm">
                  Tu publicación desaparecerá en 24 horas
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="¿Qué tienes en mente para compartir?"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="bg-[var(--secondary-background)] border-6 border-[var(--border)] text-[var(--foreground)] placeholder-gray-500 font-bold min-h-32 resize-none text-base shadow-[4px_4px_0px_0px_var(--border)] focus:shadow-[2px_2px_0px_0px_var(--border)] focus:translate-x-1 focus:translate-y-1 transition-all"
                  maxLength={500}
                />
                <div className="text-right text-xs font-bold text-[var(--foreground)] opacity-70">
                  {newPost.length}/500 caracteres
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={createPost}
                    disabled={loading || !newPost.trim()}
                    className="bg-[var(--chart-5)] hover:bg-[var(--chart-5-dark)] border-4 border-[var(--border)] text-white font-black w-full h-12 text-base shadow-[4px_4px_0px_0px_var(--border)] hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                        PUBLICANDO...
                      </div>
                    ) : (
                      "¡PUBLICAR!"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="p-4 space-y-4">
            <Card className="bg-[var(--chart-2)] border-8 border-[var(--border)] shadow-[12px_12px_0px_0px_var(--border)]">
              <CardHeader>
                <h2 className="text-xl font-black text-[var(--foreground)]">TU PERFIL</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] w-16 h-16">
                    <AvatarFallback
                      style={{ backgroundColor: getAvatar(user?.username).color }}
                      className="text-black font-black text-xl"
                    >
                      {getAvatar(user?.username).character}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-black text-[var(--foreground)] truncate max-w-[150px]">
                      @{user?.username || "anonymous"}
                    </h3>
                    <p className="font-bold text-[var(--foreground)] opacity-70 text-sm">
                      Activo desde {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "hoy"}
                    </p>
                  </div>
                </div>

                {/* Explicación de cómo funciona la app */}
                <Card className="bg-[var(--chart-5)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)]">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-[var(--foreground)] mt-0.5 flex-shrink-0" />
                      <div className="space-y-2">
                        <h4 className="text-base font-black text-[var(--foreground)]">¿Cómo funciona BRUTAL24?</h4>
                        <div className="text-sm font-bold text-[var(--foreground)] opacity-80 space-y-1">
                          <p>
                            🎭 <strong>Totalmente anónimo:</strong> No necesitas registrarte ni dar datos personales
                          </p>
                          <p>
                            ⏰ <strong>Contenido temporal:</strong> Todas las publicaciones se borran automáticamente
                            después de 24 horas
                          </p>
                          <p>
                            🎨 <strong>Diseño brutal:</strong> Una experiencia visual única con estilo neobrutalist
                          </p>
                          <p>
                            💬 <strong>Interacción libre:</strong> Comenta, da likes y responde sin compromisos
                          </p>
                          <p>
                            🚀 <strong>Sin algoritmos:</strong> Todo se muestra en orden cronológico, sin manipulación
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--secondary-background)] border-4 border-[var(--border)] p-3 text-center shadow-[4px_4px_0px_0px_var(--border)]">
                    <div className="text-xl font-black text-[var(--foreground)]">
                      {posts.filter((p) => p.user_id === user?.id).length}
                    </div>
                    <div className="font-bold text-[var(--foreground)] text-sm">Publicaciones</div>
                  </div>
                  <div className="bg-[var(--secondary-background)] border-4 border-[var(--border)] p-3 text-center shadow-[4px_4px_0px_0px_var(--border)]">
                    <div className="text-xl font-black text-[var(--foreground)]">{userLikes.size}</div>
                    <div className="font-bold text-[var(--foreground)] text-sm">Me gusta dados</div>
                  </div>
                </div>
                <Button
                  onClick={() => setActiveTab("feed")}
                  className="bg-[var(--chart-3)] hover:bg-[var(--chart-3-dark)] border-4 border-[var(--border)] text-white font-black w-full py-2.5 shadow-[4px_4px_0px_0px_var(--border)] hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all text-base"
                >
                  VOLVER AL FEED
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Comments Modal - Optimizado para móviles */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-md h-[85vh] bg-[var(--secondary-background)] border-8 border-[var(--border)] rounded-t-lg shadow-[0px_-8px_0px_0px_var(--border)] flex flex-col">
            {/* Header fijo */}
            <div className="flex flex-row items-center justify-between border-b-4 border-[var(--border)] p-3 bg-[var(--secondary-background)] flex-shrink-0">
              <h3 className="text-lg font-black text-[var(--foreground)]">COMENTARIOS</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedPost(null)
                  setReplyingTo(null)
                  setNewComment("")
                }}
                className="bg-[var(--chart-4)] hover:bg-[var(--chart-4-dark)] border-4 border-[var(--border)] text-white shadow-[2px_2px_0px_0px_var(--border)] hover:shadow-[1px_1px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Publicación original fija */}
            <div className="p-3 border-b-4 border-[var(--border)] bg-[var(--secondary-background)] flex-shrink-0">
              {posts.find((p) => p.id === selectedPost) && (
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="border-2 border-[var(--border)] w-8 h-8">
                    <AvatarFallback
                      style={{
                        backgroundColor: getAvatar(posts.find((p) => p.id === selectedPost)?.username || "").color,
                      }}
                      className="text-black font-black text-sm"
                    >
                      {getAvatar(posts.find((p) => p.id === selectedPost)?.username || "").character}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[var(--foreground)] font-black text-sm">
                      @{posts.find((p) => p.id === selectedPost)?.username}
                    </p>
                    <p className="text-[var(--foreground)] opacity-70 text-2xs font-bold">
                      {new Date(posts.find((p) => p.id === selectedPost)?.created_at || "").toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              )}
              <p className="text-[var(--foreground)] font-bold text-sm">
                {posts.find((p) => p.id === selectedPost)?.content}
              </p>
            </div>

            {/* Área de comentarios con scroll independiente */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-3">
                <div className="space-y-3 py-3">
                  {comments.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="font-bold text-[var(--foreground)] opacity-70 text-sm">
                        No hay comentarios aún. ¡Sé el primero en comentar!
                      </p>
                    </div>
                  ) : (
                    comments.map((comment) => {
                      const avatar = getAvatar(comment.username)
                      const isReply = !!comment.parent_id
                      const parentComment = isReply ? comments.find((c) => c.id === comment.parent_id) : null

                      return (
                        <div
                          key={comment.id}
                          className={`flex gap-3 p-3 bg-[var(--secondary-background)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] ${
                            isReply ? "ml-6" : ""
                          }`}
                        >
                          <Avatar className="border-2 border-[var(--border)] w-8 h-8">
                            <AvatarFallback
                              style={{ backgroundColor: avatar.color }}
                              className="text-black font-black text-sm"
                            >
                              {avatar.character}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <p className="text-[var(--foreground)] font-black text-sm truncate max-w-[80px]">
                                @{comment.username}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReplyingTo({ id: comment.id, username: comment.username })}
                                className="text-2xs bg-[var(--chart-3)] hover:bg-[var(--chart-3-dark)] border-2 border-[var(--border)] text-white font-bold px-1.5 py-0.5"
                              >
                                <Reply className="h-2.5 w-2.5 mr-0.5" />
                                Responder
                              </Button>
                            </div>
                            {isReply && parentComment && (
                              <p className="text-2xs text-[var(--foreground)] opacity-70 mb-0.5 truncate max-w-[150px]">
                                Respondiendo a <span className="font-bold">@{parentComment.username}</span>
                              </p>
                            )}
                            <p className="text-[var(--foreground)] font-bold text-sm">{comment.content}</p>
                            <p className="text-[var(--foreground)] opacity-70 text-2xs font-bold mt-1">
                              {new Date(comment.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Área fija para escribir comentarios - siempre en la parte inferior */}
            <div className="p-3 border-t-4 border-[var(--border)] bg-[var(--secondary-background)] flex-shrink-0">
              {replyingTo && (
                <div className="bg-[var(--chart-1)]/20 border-2 border-[var(--chart-1)] p-2 rounded-lg mb-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[var(--foreground)] opacity-70 truncate max-w-[70%]">
                      Respondiendo a <span className="font-black">@{replyingTo.username}</span>
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyingTo(null)}
                      className="text-[var(--foreground)] opacity-70 hover:text-[var(--foreground)] p-0.5 h-auto"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder={replyingTo ? "Tu respuesta..." : "Escribe un comentario..."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 bg-[var(--secondary-background)] border-4 border-[var(--border)] text-[var(--foreground)] placeholder-gray-500 font-bold text-sm shadow-[2px_2px_0px_0px_var(--border)] focus:shadow-[1px_1px_0px_0px_var(--border)] focus:translate-x-1 focus:translate-y-1 transition-all h-10"
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && addComment(selectedPost)}
                  maxLength={280}
                  disabled={commentingPosts.has(selectedPost)}
                />
                <Button
                  onClick={() => addComment(selectedPost)}
                  disabled={!newComment.trim() || commentingPosts.has(selectedPost)}
                  className="bg-[var(--chart-3)] hover:bg-[var(--chart-3-dark)] border-4 border-[var(--border)] text-white font-black px-3 h-10 shadow-[2px_2px_0px_0px_var(--border)] hover:shadow-[1px_1px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50"
                >
                  {commentingPosts.has(selectedPost) ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Optimizado para móviles */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--secondary-background)] border-t-8 border-[var(--border)] p-3 shadow-[0px_-8px_0px_0px_var(--border)]">
        <div className="flex justify-around">
          <Button
            variant="ghost"
            className={`${
              activeTab === "feed"
                ? "bg-[var(--chart-3)] text-white border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)]"
                : "bg-[var(--secondary-background)] text-[var(--foreground)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:bg-gray-100"
            } font-black px-4 py-2 h-auto hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all text-xs`}
            onClick={() => setActiveTab("feed")}
          >
            <div className="flex flex-col items-center gap-1">
              <Home className="h-4 w-4" />
              <span>FEED</span>
            </div>
          </Button>
          <Button
            variant="ghost"
            className={`${
              activeTab === "search"
                ? "bg-[var(--chart-5)] text-black border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)]"
                : "bg-[var(--secondary-background)] text-[var(--foreground)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:bg-gray-100"
            } font-black px-4 py-2 h-auto hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all text-xs`}
            onClick={() => setActiveTab("search")}
          >
            <div className="flex flex-col items-center gap-1">
              <Search className="h-4 w-4" />
              <span>BUSCAR</span>
            </div>
          </Button>
          <Button
            variant="ghost"
            className={`${
              activeTab === "create"
                ? "bg-[var(--chart-5)] text-black border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)]"
                : "bg-[var(--secondary-background)] text-[var(--foreground)] border-4 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:bg-gray-100"
            } font-black px-4 py-2 h-auto hover:shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-1 hover:translate-y-1 transition-all text-xs`}
            onClick={() => setActiveTab("create")}
          >
            <div className="flex flex-col items-center gap-1">
              <Plus className="h-4 w-4" />
              <span>CREAR</span>
            </div>
          </Button>
        </div>
      </div>

      <Toaster />
    </div>
  )
}