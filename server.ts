import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

console.log("Supabase Config Check:");
console.log("- URL present:", !!supabaseUrl);
console.log("- Key present:", !!supabaseKey);
if (supabaseUrl) console.log("- URL prefix:", supabaseUrl.substring(0, 10) + "...");

let supabase: any;

if (!supabaseUrl || !supabaseKey) {
  console.error("!!! FATAL ERROR: Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables !!!");
  // Mocking to prevent crash but provide clear errors
  supabase = {
    auth: {
      signUp: async () => ({ error: { message: "Configuración incompleta: falta SUPABASE_URL o SUPABASE_ANON_KEY en los Secretos del proyecto." } }),
      signInWithPassword: async () => ({ error: { message: "Configuración incompleta: falta SUPABASE_URL o SUPABASE_ANON_KEY en los Secretos del proyecto." } }),
      getUser: async () => ({ error: { message: "Configuración incompleta." }, data: { user: null } })
    },
    from: () => ({
      select: () => ({ order: () => ({ eq: () => Promise.resolve({ data: [], error: { message: "Configuración incompleta." } }) }) }),
      insert: () => ({ select: () => Promise.resolve({ data: [], error: { message: "Configuración incompleta." } }) }),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: { message: "Configuración incompleta." } }) }) })
    })
  };
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Middleware to check auth
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    
    const token = authHeader.split(" ")[1];
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) throw error;
      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // API Routes
  app.get("/api/health-check", async (req, res) => {
    try {
      const { data, error } = await supabase.from("bienestar").select("count", { count: 'exact', head: true });
      if (error) throw error;
      res.json({ status: "ok", message: "Connected to Supabase", count: data });
    } catch (error: any) {
      res.status(500).json({ status: "error", error: error.message, details: error });
    }
  });

  app.get("/api/records", authenticate, async (req: any, res) => {
    try {
      console.log(`Fetching records for user ${req.user.id} from table 'bienestar'...`);
      const { data, error } = await supabase
        .from("bienestar")
        .select("*")
        .eq("user_id", req.user.id)
        .order("timestamp", { ascending: false });

      if (error) {
        console.error("Supabase Query Error Object:", error);
        return res.status(500).json({ 
          error: error.message || "Query failed", 
          code: error.code,
          hint: error.hint,
          details: error.details 
        });
      }
      
      res.json(data || []);
    } catch (err: any) {
      console.error("Server Catch Error:", err);
      res.status(500).json({ 
        error: "Internal server error during fetch", 
        message: err.message
      });
    }
  });

  app.post("/api/records", authenticate, async (req: any, res) => {
    const { type, value1, value2, value3, notes, timestamp } = req.body;
    try {
      const { data, error } = await supabase
        .from("bienestar")
        .insert([
          { 
            type, 
            value1, 
            value2, 
            value3,
            notes, 
            timestamp: timestamp || new Date().toISOString(),
            user_id: req.user.id 
          }
        ])
        .select();

      if (error) {
        console.error("--- SUPABASE INSERT ERROR START ---");
        console.error("RAW ERROR:", error);
        const errorDetails = {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status: error.status
        };
        console.error("FORMATTED ERROR:", JSON.stringify(errorDetails, null, 2));
        console.error("--- SUPABASE INSERT ERROR END ---");
        
        return res.status(500).json({ 
          error: error.message || "Insert failed", 
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      }
      res.json(data[0]);
    } catch (err: any) {
      console.error("Server Catch Error (Insert):", err);
      res.status(500).json({ error: "Internal server error during insert", message: err.message });
    }
  });

  app.delete("/api/records/:id", authenticate, async (req: any, res) => {
    try {
      const { error } = await supabase
        .from("bienestar")
        .delete()
        .eq("id", req.params.id)
        .eq("user_id", req.user.id);

      if (error) {
        console.error("Supabase Delete Error Object:", error);
        return res.status(500).json({ 
          error: error.message || "Delete failed", 
          code: error.code,
          details: error.details 
        });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Server Catch Error (Delete):", err);
      res.status(500).json({ error: "Internal server error during delete", message: err.message });
    }
  });

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log(`Serving static files from ${distPath}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
