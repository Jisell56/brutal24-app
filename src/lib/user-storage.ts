import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

// Interfaz para el usuario anónimo
export interface AnonymousUser {
  id: string
  username: string
  created_at: string
}

// Interfaz para los likes del usuario
export interface UserLikes {
  user_id: string
  post_ids: string[]
  updated_at: string
}

// Función para obtener o crear un usuario anónimo
export const getAnonymousUser = async (): Promise<AnonymousUser> => {
  // Primero intentamos obtener del localStorage
  if (typeof window !== "undefined") {
    const storedUser = localStorage.getItem("brutal24_user")
    if (storedUser) {
      const user = JSON.parse(storedUser)
      // Sincronizamos con Supabase en segundo plano
      syncUserToSupabase(user).catch(console.error)
      return user
    }
  }

  // Si no hay usuario en localStorage, generamos uno nuevo
  const newUser = createAnonymousUser()

  // Guardamos en localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem("brutal24_user", JSON.stringify(newUser))
  }

  // Sincronizamos con Supabase
  await syncUserToSupabase(newUser)

  return newUser
}

// Función para crear un usuario anónimo
const createAnonymousUser = (): AnonymousUser => {
  const adjectives = ["Brutal", "Neon", "Cyber", "Dark", "Wild", "Bold", "Sharp", "Raw", "Fierce", "Loud"]
  const nouns = ["Punk", "Rebel", "Ghost", "Storm", "Fire", "Beast", "Wolf", "Hawk", "Viper", "Phoenix"]
  const numbers = Math.floor(Math.random() * 999) + 1

  return {
    id: `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    username: `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${numbers}`,
    created_at: new Date().toISOString(),
  }
}

// Función para sincronizar usuario con Supabase
export const syncUserToSupabase = async (user: AnonymousUser): Promise<void> => {
  const supabase = createClientComponentClient()

  try {
    // Verificamos si el usuario ya existe
    const { data, error } = await supabase.from("anonymous_users").select().eq("id", user.id).single()

    if (error && error.code !== "PGRST116") {
      console.error("Error checking user:", error)
      return
    }

    // Si no existe, lo creamos
    if (!data) {
      const { error: insertError } = await supabase.from("anonymous_users").insert({
        id: user.id,
        username: user.username,
        created_at: user.created_at,
      })

      if (insertError) {
        console.error("Error creating user:", insertError)
      }
    }
  } catch (error) {
    console.error("Error syncing user:", error)
  }
}

// Función para obtener likes del usuario
export const getUserLikes = async (userId: string): Promise<Set<string>> => {
  // Primero intentamos obtener del localStorage
  if (typeof window !== "undefined") {
    const storedLikes = localStorage.getItem("brutal24_likes")
    if (storedLikes) {
      return new Set(JSON.parse(storedLikes))
    }
  }

  // Si no hay likes en localStorage, intentamos obtener de Supabase
  const supabase = createClientComponentClient()

  try {
    const { data, error } = await supabase.from("user_likes").select("post_ids").eq("user_id", userId).single()

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching likes:", error)
      return new Set()
    }

    if (data && data.post_ids) {
      // Guardamos en localStorage para acceso rápido
      if (typeof window !== "undefined") {
        localStorage.setItem("brutal24_likes", JSON.stringify(data.post_ids))
      }
      return new Set(data.post_ids)
    }
  } catch (error) {
    console.error("Error getting user likes:", error)
  }

  return new Set()
}

// Función para sincronizar likes con Supabase
export const syncLikesToSupabase = async (userId: string, likes: Set<string>): Promise<void> => {
  const supabase = createClientComponentClient()
  const likesArray = Array.from(likes)

  try {
    // Guardamos en localStorage primero
    if (typeof window !== "undefined") {
      localStorage.setItem("brutal24_likes", JSON.stringify(likesArray))
    }

    // Verificamos si ya existe un registro para este usuario
    const { data, error } = await supabase.from("user_likes").select().eq("user_id", userId).single()

    if (error && error.code !== "PGRST116") {
      console.error("Error checking likes:", error)
      return
    }

    if (data) {
      // Actualizamos el registro existente
      const { error: updateError } = await supabase
        .from("user_likes")
        .update({
          post_ids: likesArray,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)

      if (updateError) {
        console.error("Error updating likes:", updateError)
      }
    } else {
      // Creamos un nuevo registro
      const { error: insertError } = await supabase.from("user_likes").insert({
        user_id: userId,
        post_ids: likesArray,
        updated_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error("Error inserting likes:", insertError)
      }
    }
  } catch (error) {
    console.error("Error syncing likes:", error)
  }
}