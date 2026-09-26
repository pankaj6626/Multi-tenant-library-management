import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { io } from "socket.io-client";
import "./App.css";
import "./premium.css";

const API = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API.replace(/\/api\/v1$/, "")).replace(/\/$/, "");
type View =
  | "home"
  | "library"
  | "librarian-register"
  | "student-register"
  | "login"
  | "forgot-password"
  | "admin"
  | "librarian"
  | "student"
  | "community";
type Values = Record<string, string>;
type FormField =
  | [string, string]
  | [string, string, string]
  | [string, string, string | undefined, (values: Values) => boolean];
type Toast = { message: string; kind: "success" | "error" };
type AuthSession = {
  accessToken: string;
  role: string;
  seatAssigned?: boolean;
};
type NotificationItem = {
  _id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

const formatDateTime = (value: string) => new Date(value).toLocaleString(
  undefined,
  { dateStyle: "medium", timeStyle: "short" },
);

const formatRelativeTime = (value: string) => {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return `${elapsedSeconds}s`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
};
type ApiErrorBody = {
  message?: string;
  code?: string;
  details?: Record<string, string> | string[];
  requestId?: string;
};

class ApiError extends Error {
  status: number;
  code?: string;
  details?: ApiErrorBody["details"];
  requestId?: string;

  constructor(status: number, body: ApiErrorBody, fallback: string) {
    super(body.message || fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.requestId = body.requestId;
  }
}

let accessToken = "";

const setAccessToken = (token: string) => {
  accessToken = token;
};

const notifySuccess = (message: string) => {
  window.dispatchEvent(
    new CustomEvent("library-toast", {
      detail: { message, kind: "success" },
    }),
  );
};

async function refreshAccessToken(): Promise<AuthSession | null> {
  const res = await fetch(`${API}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (res.status === 204) return null;
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
  if (!res.ok) throw new ApiError(res.status, body, "Session expired");
  return body as AuthSession;
}

const readResponse = async (res: Response): Promise<unknown> => {
  if (res.status === 204) return null;
  if (!res.headers.get("content-type")?.includes("application/json")) return null;
  return res.json().catch(() => null);
};

async function api<T = ReturnType<typeof JSON.parse>>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const request = (requestToken: string) => fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let res = await request(accessToken || token || "");
  if (res.status === 401 && !path.startsWith("/auth/")) {
    try {
      const refreshed = await refreshAccessToken();
      if (!refreshed) throw new Error("No refresh session");
      setAccessToken(refreshed.accessToken);
      res = await request(refreshed.accessToken);
    } catch {
      window.dispatchEvent(new Event("library-auth-expired"));
    }
  }
  const data = await readResponse(res);
  if (!res.ok) {
    const errorBody = data && typeof data === "object" && !Array.isArray(data)
      ? data as ApiErrorBody
      : {};
    if (path === "/concerns" && method === "POST")
      window.dispatchEvent(
        new CustomEvent("library-toast", {
          detail: {
            message: errorBody.message || "Could not send concern",
            kind: "error",
          },
        }),
      );
    throw new ApiError(
      res.status,
      errorBody,
      `Request failed (${res.status}). Check that the backend API is running at ${API}.`,
    );
  }
  if (path === "/concerns" && method === "POST")
    window.dispatchEvent(
      new CustomEvent("library-toast", {
        detail: { message: "Concern sent to your librarian.", kind: "success" },
      }),
    );
  return data as T;
}

function App() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [seatAssigned, setSeatAssigned] = useState(false);
  const [view, setView] = useState<View>("home");
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("libraryTheme") as "light" | "dark") || "light",
  );
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    localStorage.removeItem("libraryToken");
    sessionStorage.removeItem("libraryToken");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("libraryTheme", theme);
  }, [theme]);
  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<Toast>).detail;
      setToast(detail);
    };
    window.addEventListener("library-toast", handleToast);
    return () => window.removeEventListener("library-toast", handleToast);
  }, []);
  useEffect(() => {
    const handleExpiredSession = () => {
      setAccessToken("");
      setToken("");
      setRole("");
      setSeatAssigned(false);
      setView("home");
    };
    window.addEventListener("library-auth-expired", handleExpiredSession);
    return () => window.removeEventListener("library-auth-expired", handleExpiredSession);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!token || role !== "STUDENT") return;
    api("/students/me", "GET", undefined, token)
      .then((profile) => {
        const assigned = Boolean(profile.seat);
        setSeatAssigned(assigned);
      })
      .catch(() => setSeatAssigned(false));
  }, [token, role]);
  const showToast = (message: string, kind: Toast["kind"] = "success") =>
    setToast({ message, kind });
  const applySession = (data: AuthSession, notify = true) => {
    setAccessToken(data.accessToken);
    setToken(data.accessToken);
    setRole(data.role);
    const assigned = data.role !== "STUDENT" || data.seatAssigned === true;
    setSeatAssigned(assigned);
    setView(
      data.role === "ADMIN"
        ? "admin"
        : data.role === "LIBRARIAN"
          ? "librarian"
          : "student",
    );
    if (notify) showToast("Login successful.");
  };
  useEffect(() => {
    refreshAccessToken()
      .then((session) => {
        if (!session) return;
        setAccessToken(session.accessToken);
        setToken(session.accessToken);
        setRole(session.role);
        setSeatAssigned(session.role !== "STUDENT" || session.seatAssigned === true);
        setView(
          session.role === "ADMIN"
            ? "admin"
            : session.role === "LIBRARIAN"
              ? "librarian"
              : "student",
        );
      })
      .catch(() => undefined);
  }, []);
  const logout = async () => {
    try {
      await api("/auth/logout", "POST");
    } catch {
      // Clear local state even when the server is unavailable.
    }
    setAccessToken("");
    setToken("");
    localStorage.removeItem("libraryRole");
    localStorage.removeItem("librarySeatAssigned");
    setRole("");
    setSeatAssigned(false);
    setView("home");
    showToast("You have been signed out.");
  };
  const loggedIn = (data: AuthSession) => applySession(data);
  return (
    <main className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")}>
          <span className="brand-mark">LH</span>
          <span>
            Library<span className="brand-accent">Hub</span>
          </span>
        </button>
        <div className="top-actions">
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            title={`Use ${theme === "light" ? "dark" : "light"} theme`}
            aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? "☾" : "☀"}
          </button>
          {token && (role === "LIBRARIAN" || (role === "STUDENT" && seatAssigned)) && (
            <button
              className="community-link"
              onClick={() =>
                setView(
                  view === "community"
                    ? (role.toLowerCase() as View)
                    : "community",
                )
              }
            >
              {view === "community" ? "Dashboard" : "Community"}
            </button>
          )}
          {token && (role === "ADMIN" || role === "LIBRARIAN" || role === "STUDENT") && (
            <NotificationBell token={token} role={role} />
          )}
          {token ? (
            <>
              <span className="role-pill">{role}</span>
              <button className="link" onClick={logout}>
                Sign out
              </button>
            </>
          ) : view !== "home" ? (
            <button className="link" onClick={() => setView("login")}>
              Login
            </button>
          ) : null}
        </div>
      </header>
      {toast && (
        <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
          <span className="toast-icon">
            {toast.kind === "success" ? "✓" : "!"}
          </span>
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      {view === "home" && <Home go={setView} />}{" "}
      {view === "library" && <LibraryForm done={showToast} go={setView} />}{" "}
      {view === "librarian-register" && (
        <LibrarianForm done={showToast} go={setView} />
      )}{" "}
      {view === "student-register" && (
        <StudentForm done={showToast} go={setView} />
      )}{" "}
      {view === "login" && <Login done={loggedIn} forgot={() => setView("forgot-password")} />}{" "}
      {view === "forgot-password" && <ForgotPassword done={showToast} go={() => setView("login")} />} {" "}
      {view === "admin" && <Admin token={token} />}{" "}
      {view === "librarian" && <Librarian token={token} />}{" "}
      {view === "student" && <Student token={token} />} {" "}
      {view === "community" && (
        <CommunicationPortal
          token={token}
          role={role as "STUDENT" | "LIBRARIAN"}
        />
      )}
    </main>
  );
}

function NotificationBell({ token, role }: { token: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const unreadCount = items.filter((item) => !item.readAt).length;

  const load = async () => {
    setLoading(true);
    try {
      setItems(await api<NotificationItem[]>("/notifications", "GET", undefined, token));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (role !== "STUDENT" && role !== "LIBRARIAN") return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on("notification:created", (notification: NotificationItem) => {
      setItems((current) => [
        notification,
        ...current.filter((item) => item._id !== notification._id),
      ]);
      notifySuccess(notification.title);
    });
    return () => {
      socket.disconnect();
    };
  }, [token, role]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!notificationRef.current?.contains(target)
        || !target.closest(".notification-bell, .notification-panel")) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, "PATCH", undefined, token);
      setItems((current) => current.map((item) => (
        item._id === id ? { ...item, readAt: new Date().toISOString() } : item
      )));
    } catch {
      // The notification remains visible if marking it read fails.
    }
  };

  const markAllRead = async () => {
    try {
      await api("/notifications/read-all", "PATCH", undefined, token);
      setItems((current) => current.map((item) => ({
        ...item,
        readAt: item.readAt || new Date().toISOString(),
      })));
    } catch {
      // Keep the unread state when the server cannot be reached.
    }
  };

  return (
    <div className="notification-center" ref={notificationRef}>
      <button
        className="notification-bell"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        title="Notifications"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && <b>{unreadCount > 9 ? "9+" : unreadCount}</b>}
      </button>
      {open && (
        <section className="notification-panel" aria-label="Notifications">
          <header>
            <div><p className="eyebrow">YOUR UPDATES</p><h2>Notifications</h2></div>
            {unreadCount > 0 && <button className="notification-read-all" onClick={markAllRead}>Mark all read</button>}
          </header>
          {loading ? <p className="notification-empty">Loading updates...</p> : items.length === 0 ? (
            <p className="notification-empty">You are all caught up.</p>
          ) : (
            <div className="notification-list">
              {items.map((item) => (
                <button
                  className={`notification-item ${item.readAt ? "read" : "unread"}`}
                  key={item._id}
                  onClick={() => markRead(item._id)}
                >
                  <span className="notification-mark">{item.readAt ? "·" : "•"}</span>
                  <span><strong>{item.title}</strong><small>{item.message}</small><time>{formatDateTime(item.createdAt)}</time></span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Home({ go }: { go: (v: View) => void }) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">LIBRARY MANAGEMENT SYSTEM</p>
          <h1>A calmer way to run your library.</h1>
          <p>
            Keep every seat, shift, payment and conversation beautifully
            organized in one focused workspace.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => go("library")}>
              Register a library <span>↗</span>
            </button>
            <button
              className="text-action"
              onClick={() => document.getElementById("libraryhub-features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explore LibraryHub <span>↓</span>
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-glow" />
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="art-sun" />
          <div className="art-shelf shelf-one" />
          <div className="art-shelf shelf-two" />
          <div className="art-book book-one" />
          <div className="art-book book-two" />
          <div className="art-book book-three" />
          <div className="art-library-card card-main">
            <span className="card-kicker">TODAY'S FLOW</span>
            <strong>42 <small>active readers</small></strong>
            <span className="card-bar"><i /></span>
          </div>
          <div className="art-library-card card-mini">
            <span className="mini-dot" />
            <span>Seats in rhythm</span>
          </div>
          <div className="art-note">
            Open
            <br />
            <strong>spaces</strong>
            <br />
            <span>made simple</span>
          </div>
        </div>
      </section>
      <section className="home-strip">
        <span><i className="strip-pulse" /> Designed for daily flow</span>
        <div>
          <span>01 / Seats</span>
          <span>02 / People</span>
          <span>03 / Progress</span>
        </div>
      </section>
      <section className="role-grid">
        <Role
          title="Librarian"
          label="OPERATIONS"
          text="Manage seats, students, fees and concerns without the busywork."
          login={() => go("login")}
          register={() => go("librarian-register")}
        />
        <Role
          title="Student"
          label="YOUR SPACE"
          text="See your seat, payment record and reach your librarian in seconds."
          login={() => go("login")}
          register={() => go("student-register")}
        />
        <Role
          title="Admin"
          label="OVERSIGHT"
          text="Approve libraries and librarian accounts with a clear view of what is next."
          login={() => go("login")}
        />
      </section>
      <FeatureShowcase />
      <WhyLibraryHub />
      <Faq />
      <HowItWorks go={go} />
      <footer className="home-footer">
        <div className="footer-brand">
          <span className="brand-mark">LH</span>
          <div>
            <strong>Library<span className="brand-accent">Hub</span></strong>
            <span>One calmer place for every reader.</span>
          </div>
        </div>
        <div className="footer-meta">
          <span>Built for libraries, librarians, students and community.</span>
          <span>© {new Date().getFullYear()} LibraryHub. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}

const features = [
  ["▦", "Seat intelligence", "See every seat, shift and assignment at a glance."],
  ["◒", "Payment clarity", "Keep fee records organized and easy to follow."],
  ["◎", "Student space", "Give students a simple view of their seat and history."],
  ["✦", "Community pulse", "Share posts, notices and useful updates in one place."],
  ["✋", "Concerns, heard", "Bring questions directly to the people who can help."],
  ["⌁", "Decisions in sync", "Help admins and librarians move requests forward."],
] as const;

function FeatureShowcase() {
  return (
    <section className="home-section feature-section" id="libraryhub-features">
      <SectionIntro eyebrow="EVERYDAY ADVANTAGE" title="The details that make a library feel effortless." text="LibraryHub brings the quiet, important work into one clear rhythm, so people spend less time searching and more time reading." />
      <div className="feature-grid">
        {features.map(([icon, title, text], index) => (
          <article className="feature-card" key={title} style={{ "--card-index": index } as CSSProperties}>
            <span className="feature-icon" aria-hidden="true">{icon}</span>
            <span className="feature-number">0{index + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function WhyLibraryHub() {
  return (
    <section className="why-section home-section">
      <div className="why-statement">
        <p className="eyebrow">WHY LIBRARYHUB</p>
        <h2>A library is more than a room. It is a community in motion.</h2>
        <p>That is why LibraryHub is designed for everyone in the loop. Librarians run the day, students find their place, admins keep standards high, and the community stays connected.</p>
        <div className="why-signature"><span>LH</span><span>One shared rhythm<br /><strong>for every reader.</strong></span></div>
      </div>
      <div className="why-points">
        <article><span className="point-icon">01</span><div><h3>Made for students too</h3><p>Students can see their assignment, payment record and essential updates without chasing information.</p></div></article>
        <article><span className="point-icon">02</span><div><h3>Community is built in</h3><p>Notices, posts, comments and concerns turn a collection of desks into a place people belong.</p></div></article>
        <article><span className="point-icon">03</span><div><h3>Clarity compounds</h3><p>When every role sees the right information, small daily decisions become noticeably easier.</p></div></article>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  const questions = [
    ["Who is LibraryHub for?", "LibraryHub supports admins, librarians, students and the wider library community. Each role gets a focused space for the work and information that matters to them."],
    ["Can students use the application directly?", "Yes. Students can sign in to view their seat assignment, payment history and communication from their library once their account is approved and assigned a seat."],
    ["What can a librarian manage?", "Librarians can manage seats and shifts, assign or release students, record payments, review concerns and keep the community informed."],
    ["How does the community area help?", "The community area brings posts, notices, comments and likes together, giving people a calm place to share updates and stay connected."],
  ];
  return (
    <section className="home-section faq-section">
      <SectionIntro eyebrow="GOOD TO KNOW" title="Questions, answered clearly." text="A few helpful details before you find your way in." />
      <div className="faq-list">
        {questions.map(([question, answer], index) => (
          <div className={`faq-item ${open === index ? "is-open" : ""}`} key={question}>
            <button className="faq-question" onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}>
              <span><i>0{index + 1}</i>{question}</span><strong>{open === index ? "−" : "+"}</strong>
            </button>
            <div className="faq-answer"><p>{answer}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks({ go }: { go: (v: View) => void }) {
  return (
    <section className="how-section home-section">
      <SectionIntro eyebrow="A SIMPLE START" title="How it works." text="A clear path from first hello to a library that moves beautifully." />
      <div className="how-steps">
        <article><span className="step-mark">01</span><div><h3>Set up your space</h3><p>Register your library and tell us about the place you are building.</p></div></article>
        <article><span className="step-mark">02</span><div><h3>Bring people in</h3><p>Approve librarians, welcome students and give each person the right view.</p></div></article>
        <article><span className="step-mark">03</span><div><h3>Keep the rhythm</h3><p>Manage seats, payments, concerns and community updates from one calm desk.</p></div></article>
      </div>
      <div className="how-cta"><span>Ready to make more room for what matters?</span><button className="primary" onClick={() => go("library")}>Register your library <span>↗</span></button></div>
    </section>
  );
}

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="section-intro"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{text}</p></div>;
}
function Role({
  title,
  label,
  text,
  login,
  register,
}: {
  title: string;
  label: string;
  text: string;
  login: () => void;
  register?: () => void;
}) {
  return (
    <article className="role-card">
      <div className="role-card-top">
        <span className="role-label">{label}</span>
        <span className="role-arrow">↗</span>
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="role-actions">
        <button className="primary small" onClick={login}>
          Login
        </button>
        {register && (
          <button className="outline small" onClick={register}>
            Register
          </button>
        )}
      </div>
    </article>
  );
}
function Form({
  title,
  fields,
  submit,
  button,
  footer,
}: {
  title: string;
  fields: FormField[];
  submit: (v: Values) => Promise<void>;
  button: string;
  footer?: ReactNode;
}) {
  const [values, setValues] = useState<Values>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (fields.some(([name]) => name === "confirmPassword") && values.password !== values.confirmPassword) {
      setError("Passwords do not match. Please enter the same password in both fields.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit(values);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="form-wrap page-enter">
      <div className="form-heading">
        <p className="eyebrow">GET STARTED</p>
        <h1>{title}</h1>
        <p>Set up your details and we will take care of the rest.</p>
      </div>
      <form onSubmit={send}>
        {fields.filter((field) => {
          const visible = field[3];
          return typeof visible !== "function" || visible(values);
        }).map(([name, label, type]) => (
          <label key={name}>
            {label}
            <span className={type === "password" ? "password-input" : undefined}>
              <input
                required={name !== "libraryCodeOptional"}
                type={type === "password" && visiblePasswords[name] ? "text" : type || "text"}
                value={values[name] || ""}
                onChange={(e) => setValues({ ...values, [name]: e.target.value })}
              />
              {type === "password" && (
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setVisiblePasswords({ ...visiblePasswords, [name]: !visiblePasswords[name] })}
                  aria-label={visiblePasswords[name] ? `Hide ${label}` : `Show ${label}`}
                  title={visiblePasswords[name] ? `Hide ${label}` : `Show ${label}`}
                >
                  {visiblePasswords[name] ? "◉" : "◌"}
                </button>
              )}
            </span>
          </label>
        ))}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Please wait..." : button}
          <span>→</span>
        </button>
        {footer}
      </form>
    </section>
  );
}
const LibraryForm = ({
  done,
  go,
}: {
  done: (s: string) => void;
  go: (v: View) => void;
}) => (
  <Form
    title="Register your library"
    fields={[
      ["name", "Library name"],
      ["country", "Country"],
      ["city", "City"],
      ["address", "Address"],
      ["pincode", "Pincode"],
      ["mobile", "Mobile number"],
      ["email", "Email", "email"],
    ]}
    button="Submit for approval"
    submit={async (v) => {
      await api("/libraries/register", "POST", v);
      done("Library registration submitted for approval.");
      go("home");
    }}
  />
);
const LibrarianForm = ({
  done,
  go,
}: {
  done: (s: string) => void;
  go: (v: View) => void;
}) => (
  <Form
    title="Librarian registration"
    fields={[
      ["libraryCode", "Library code"],
      ["name", "Full name"],
      ["email", "Email", "email"],
      ["password", "Password", "password"],
      ["confirmPassword", "Confirm password", "password"],
      ["mobile", "Mobile number"],
      ["totalSeats", "Total seats", "number"],
    ]}
    button="Submit for approval"
    submit={async (v) => {
      await api("/librarians/register", "POST", {
        ...v,
        totalSeats: Number(v.totalSeats),
      });
      done("Librarian request submitted.");
      go("home");
    }}
  />
);
const StudentForm = ({
  done,
  go,
}: {
  done: (s: string) => void;
  go: (v: View) => void;
}) => (
  <Form
    title="Student registration"
    fields={[
      ["libraryCode", "Library code"],
      ["name", "Full name"],
      ["email", "Email", "email"],
      ["password", "Password", "password"],
      ["confirmPassword", "Confirm password", "password"],
      ["mobile", "Mobile number"],
    ]}
    button="Create student account"
    submit={async (v) => {
      await api("/students/register", "POST", v);
      done("Student account created. You can now login.");
      go("login");
    }}
  />
);
function Login({
  done,
  forgot,
}: {
  done: (x: AuthSession) => void;
  forgot: () => void;
}) {
  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL).toLowerCase();
  return (
    <Form
      title="Welcome back"
      fields={[
        ["email", "Email", "email"],
        ["password", "Password", "password"],
        ["libraryCodeOptional", "Library code", undefined, (values) => values.email?.trim().toLowerCase() !== adminEmail],
      ]}
      button="Enter dashboard"
      submit={async (v) => {
        const { libraryCodeOptional, ...rest } = v;
        done(
          await api("/auth/login", "POST", {
            ...rest,
            libraryCode: libraryCodeOptional,
          }),
        );
      }}
      footer={
        <button className="link form-link" type="button" onClick={forgot}>
          Forgot password?
        </button>
      }
    />
  );
}

function ForgotPassword({
  done,
  go,
}: {
  done: (message: string) => void;
  go: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [stage, setStage] = useState<"email" | "verify">("email");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const requestCode = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>("/auth/password-reset/request", "POST", { email });
      setMessage(result.message);
      setStage("verify");
      setResendSeconds(60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request a verification code");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (stage === "email") {
      await requestCode();
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please enter the same password in both fields.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>("/auth/password-reset/verify", "POST", {
        email,
        code,
        password,
        confirmPassword,
      });
      done(result.message);
      go();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="form-wrap page-enter">
      <div className="form-heading">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>{stage === "email" ? "Reset your password" : "Verify your email"}</h1>
        <p>{stage === "email" ? "We will send a verification code to your account email." : `Enter the code sent to ${email}, then choose a new password.`}</p>
      </div>
      <form onSubmit={submit}>
        {stage === "email" ? (
          <label>
            Email
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        ) : (
          <>
            <label>
              Verification code
              <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </label>
            <label>
              New password
              <input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label>
              Confirm new password
              <input required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
            <button className="link form-link" type="button" disabled={busy || resendSeconds > 0} onClick={requestCode}>
              {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend verification code"}
            </button>
          </>
        )}
        {message && <p className="muted" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Please wait..." : stage === "email" ? "Send verification code" : "Update password"}
          <span>→</span>
        </button>
        <button className="link form-link" type="button" onClick={go}>Back to login</button>
      </form>
    </section>
  );
}

function Admin({ token }: { token: string }) {
  const [libraries, setLibraries] = useState<any[]>([]),
    [librarians, setLibrarians] = useState<any[]>([]),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const [a, b] = await Promise.all([
        api("/admin/libraries", "GET", undefined, token),
        api("/admin/librarians", "GET", undefined, token),
      ]);
      setLibraries(a);
      setLibrarians(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const approve = async (k: string, id: string) => {
    try {
      await api(`/admin/${k}/${id}/approve`, "PATCH", {}, token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to approve request");
    }
  };
  const reject = async (k: string, id: string) => {
    try {
      await api(`/admin/${k}/${id}/reject`, "PATCH", {}, token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reject request");
    }
  };
  return (
    <Dashboard
      title="Admin overview"
      subtitle="A clear queue for the decisions that keep every library moving."
      kicker="CONTROL CENTRE"
      error={error}
    >
      <div className="stats">
        <Stat n={libraries.length} t="Libraries" icon="⌂" />
        <Stat n={librarians.length} t="Librarians" icon="◎" />
        <Stat
          n={
            libraries.filter((x) => x.status === "PENDING").length +
            librarians.filter((x) => x.status === "PENDING").length
          }
          t="Awaiting review"
          icon="◷"
        />
      </div>
      <section className="panel">
        <PanelHeading
          title="Library requests"
          meta={`${libraries.length} total`}
        />
        <Table
          heads={["Library", "City", "Status", "Action"]}
          rows={libraries.map((x) => [
            x.name,
            x.city,
            <Status value={x.status} />,
            x.status === "PENDING" ? (
              <>
                <button
                  className="primary small"
                  onClick={() => approve("libraries", x._id)}
                >
                  Approve
                </button>
                <button
                  className="danger small"
                  onClick={() => reject("libraries", x._id)}
                >
                  Reject
                </button>
              </>
            ) : (
              x.libraryCode || "—"
            ),
          ])}
        />
      </section>
      <section className="panel">
        <PanelHeading
          title="Librarian requests"
          meta={`${librarians.length} total`}
        />
        <Table
          heads={["Name", "Library", "Seats", "Status", "Action"]}
          rows={librarians.map((x) => [
            x.name,
            x.library?.name,
            x.totalSeats,
            <Status value={x.status} />,
            x.status === "PENDING" ? (
              <>
                <button
                  className="primary small"
                  onClick={() => approve("librarians", x._id)}
                >
                  Approve
                </button>
                <button
                  className="danger small"
                  onClick={() => reject("librarians", x._id)}
                >
                  Reject
                </button>
              </>
            ) : (
              "—"
            ),
          ])}
        />
      </section>
    </Dashboard>
  );
}
function Librarian({ token }: { token: string }) {
  const [activeSection, setActiveSection] = useState<
    "seats" | "assign" | "payment" | "concerns"
  >("seats");
  const [assignView, setAssignView] = useState<"history" | "pending" | "details">("pending");
  const [studentSearch, setStudentSearch] = useState("");
  const [seats, setSeats] = useState<any[]>([]),
    [students, setStudents] = useState<any[]>([]),
    [concerns, setConcerns] = useState<any[]>([]),
    [studentHistory, setStudentHistory] = useState<any[]>([]),
    [error, setError] = useState(""),
    [assign, setAssign] = useState<Values>({}),
    [fee, setFee] = useState<Values>({});
  const load = async () => {
    try {
      const [a, b, c, d] = await Promise.all([
        api("/seats", "GET", undefined, token),
        api("/libraries/students", "GET", undefined, token),
        api("/concerns", "GET", undefined, token),
        api("/libraries/students/history", "GET", undefined, token),
        api("/fees/pending", "GET", undefined, token),
      ]);
      setSeats(a);
      setStudents(b);
      setConcerns(c);
      setStudentHistory(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const occupied = seats.reduce((n, s) => n + s.assignments.length, 0),
    overdue = seats.reduce(
      (n, s) =>
        n + s.assignments.filter((a: any) => a.fee.status === "OVERDUE").length,
      0,
    ),
    raised = seats.reduce(
      (n, s) => n + s.assignments.filter((a: any) => a.hasOpenConcern).length,
      0,
    );
  const assignedStudentIds = new Set(
    seats.flatMap((seat) => seat.assignments.map((assignment: any) => String(assignment.student._id))),
  );
  const historicalStudentIds = new Set(
    studentHistory.map((entry) => String(entry.student)),
  );
  const assignableStudents = students.filter(
    (student) => !historicalStudentIds.has(String(student._id)),
  );
  const unassignedStudents = students.filter(
    (student) =>
      !assignedStudentIds.has(String(student._id)) &&
      !historicalStudentIds.has(String(student._id)),
  );
  const studentAssignments = new Map<string, { seat: string; shift: string }>(
    seats.flatMap((seat) => seat.assignments.map((assignment: any) => [
      String(assignment.student._id),
      { seat: seat.seatNumber, shift: assignment.shift.replace("_", " ") },
    ])),
  );
  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(studentSearch.trim().toLowerCase()),
  );
  const pendingConcerns = concerns.filter((concern) => concern.status === "OPEN");
  const resolvedConcerns = concerns.filter((concern) => concern.status !== "OPEN");
  const concernHeads = ["Student", "Mobile", "Concern", "Status", ""];
  const concernRows = (items: any[]) => items.map((c) => [
    c.student?.name,
    c.student?.mobile,
    c.message,
    <Status value={c.status} />,
    c.status === "OPEN" ? (
      <button
        className="outline small"
        onClick={async () => {
          await api(`/concerns/${c._id}/resolve`, "PATCH", {}, token);
          load();
        }}
      >
        Resolve
      </button>
    ) : (
      ""
    ),
  ]);
  return (
    <Dashboard
      title="Good morning, librarian"
      subtitle="Here is the pulse of your library today."
      kicker="LIBRARIAN DESK"
      error={error}
    >
      <div className="stats">
        <Stat n={seats.length * 2} t="Total seats" icon="▦" />
        <Stat n={occupied} t="Occupied" icon="●" />
        <Stat n={seats.length * 2 - occupied} t="Available" icon="＋" />
        <Stat n={raised} t="Raised hands" icon="✋" accent="amber" />
        <Stat n={overdue} t="Pending fees" icon="◷" accent="rose" />
      </div>
      {activeSection === "seats" && <section className="panel librarian-panel">
        <PanelHeading
          title="Seat map"
          meta={raised ? `${raised} need attention` : "All quiet for now"}
        />
        <div className="seat-map">
          {seats.map((s) => (
            <div
              className={`seat ${s.assignments.some((a: any) => a.fee.status === "OVERDUE") ? "overdue" : ""}`}
              key={s._id}
            >
              <div className="seat-head">
                <strong>{s.seatNumber}</strong>
                <span className="seat-dot" />
              </div>
              {s.assignments.length ? (
                s.assignments.map((a: any) => (
                  <small className="seat-assignment" key={a.shift}>
                    <span>{a.shift.replace("_", " ")} · {a.student.name}</span>{" "}
                    {a.hasOpenConcern ? (
                      <span
                        className="raised-hand"
                        title="Open concern"
                        aria-label="Open concern"
                      >
                        ✋
                      </span>
                    ) : a.fee.status === "OVERDUE" ? (
                      "🔴"
                    ) : (
                      "🟢"
                    )}
                    <button
                      className="release-action"
                      title="Release student"
                      aria-label={`Release ${a.student.name}`}
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Do you really want to remove ${a.student.name} from this seat?`,
                        );
                        if (!confirmed) return;

                        try {
                          await api(`/seats/${s._id}/release`, "PATCH", { shift: a.shift }, token);
                          notifySuccess(`${a.student.name} was removed from the library.`);
                          load();
                        } catch (x) {
                          setError(x instanceof Error ? x.message : "Could not release student");
                        }
                      }}
                    >
                      ×
                    </button>
                  </small>
                ))
              ) : (
                <small className="available">Available</small>
              )}
            </div>
          ))}
        </div>
      </section>}
      {activeSection === "assign" && <section className="panel librarian-panel">
          <PanelHeading title="Assign student" meta="Seat access" />
          <form
            className="compact-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(
                  `/seats/${assign.seatId}/assign`,
                  "POST",
                  { studentId: assign.studentId, shift: assign.shift },
                  token,
                );
                notifySuccess("Seat assigned successfully.");
                setAssign({});
                load();
              } catch (x) {
                setError(x instanceof Error ? x.message : "Could not assign");
              }
            }}
          >
            <Select
              value={assign.seatId}
              set={(v) => setAssign({ ...assign, seatId: v })}
              label="Select seat"
              options={seats.map((s) => [s._id, s.seatNumber])}
            />
            <SearchableSelect
              value={assign.studentId}
              set={(v) => setAssign({ ...assign, studentId: v })}
              label="Select student"
              options={assignableStudents.map((s) => [s._id, s.name])}
            />
            <Select
              value={assign.shift}
              set={(v) => setAssign({ ...assign, shift: v })}
              label="Select shift"
              options={[
                ["SHIFT_1", "Shift 1"],
                ["SHIFT_2", "Shift 2"],
              ]}
            />
            <button className="primary small">
              Assign student <span>→</span>
            </button>
          </form>
          <div className="assign-view-tabs" role="tablist" aria-label="Student records">
            <button className={assignView === "history" ? "active" : ""} onClick={() => setAssignView("history")}>Student history</button>
            <button className={assignView === "pending" ? "active" : ""} onClick={() => setAssignView("pending")}>Pending registrations</button>
            <button className={assignView === "details" ? "active" : ""} onClick={() => setAssignView("details")}>Student details</button>
          </div>
          {assignView === "history" && <div className="student-history">
            <PanelHeading title="Student history" meta={`${studentHistory.length} former students`} />
            <Table
              heads={["Name", "Email", "Mobile", "Joined", "Left"]}
              rows={studentHistory.map((entry) => [
                entry.name,
                entry.email,
                entry.mobile,
                new Date(entry.joinedAt).toLocaleDateString(),
                new Date(entry.leftAt).toLocaleDateString(),
              ])}
            />
          </div>}
          {assignView === "pending" && <div className="student-history">
            <PanelHeading title="Pending registrations" meta={`${unassignedStudents.length} awaiting seat`} />
            <Table
              heads={["Name", "Email", "Mobile", "Action"]}
              rows={unassignedStudents.map((student) => [
                student.name,
                student.email,
                student.mobile,
                <button
                  className="danger small"
                  onClick={async () => {
                    try {
                      await api(`/libraries/students/${student._id}`, "DELETE", undefined, token);
                      load();
                    } catch (x) {
                      setError(x instanceof Error ? x.message : "Could not remove student");
                    }
                  }}
                >
                  Remove
                </button>,
              ])}
            />
          </div>}
          {assignView === "details" && <div className="student-history student-details-table">
            <PanelHeading
              title="Student details"
              meta={studentSearch ? `${filteredStudents.length} of ${students.length} students` : `${students.length} students`}
            />
            <div className="student-search">
              <input
                type="search"
                placeholder="Search student by name"
                aria-label="Search student by name"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              {studentSearch && (
                <button
                  type="button"
                  className="student-search-clear"
                  onClick={() => setStudentSearch("")}
                  aria-label="Clear student search"
                >
                  ×
                </button>
              )}
            </div>
            <Table
              heads={["Name", "Email", "Mobile", "Joined", "Seat", "Shift", "Last payment", "Status"]}
              rows={filteredStudents.map((student) => {
                const assignment = studentAssignments.get(String(student._id));
                return [
                  student.name,
                  student.email,
                  student.mobile,
                  student.createdAt ? new Date(student.createdAt).toLocaleDateString() : "Unknown",
                  assignment?.seat || "Not assigned",
                  assignment?.shift || "—",
                  student.lastPaymentDate ? new Date(student.lastPaymentDate).toLocaleDateString() : "No payment",
                  <Status value={historicalStudentIds.has(String(student._id)) ? "INACTIVE" : "ACTIVE"} />,
                ];
              })}
            />
          </div>}
      </section>}
      {activeSection === "payment" && <section className="panel librarian-panel">
          <PanelHeading title="Record payment" meta="Offline entry" />
          <form
            className="compact-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(
                  `/students/${fee.studentId}/fees`,
                  "POST",
                  {
                    amount: Number(fee.amount),
                    paidAt: fee.paidAt || undefined,
                  },
                  token,
                );
                notifySuccess("Payment recorded successfully.");
                setFee({});
                load();
              } catch (x) {
                setError(x instanceof Error ? x.message : "Could not save fee");
              }
            }}
          >
            <SearchableSelect
              value={fee.studentId}
              set={(v) => setFee({ ...fee, studentId: v })}
              label="Select student"
              options={students.map((s) => [s._id, s.name])}
            />
            <input
              required
              type="number"
              placeholder="Amount"
              value={fee.amount || ""}
              onChange={(e) => setFee({ ...fee, amount: e.target.value })}
            />
            <input
              type="date"
              value={fee.paidAt || ""}
              onChange={(e) => setFee({ ...fee, paidAt: e.target.value })}
            />
            <button className="primary small">
              Save payment <span>→</span>
            </button>
          </form>
      </section>}
      {activeSection === "concerns" && <section className="panel librarian-panel">
        <PanelHeading
          title="Student concerns"
          meta={`${pendingConcerns.length} pending`}
        />
        <div className="concern-feed" aria-label="Student concerns list">
          <div className="concern-group">
            <PanelHeading title="Pending concerns" meta={`${pendingConcerns.length} to review`} />
            <Table heads={concernHeads} rows={concernRows(pendingConcerns)} />
          </div>
          <div className="concern-group">
            <PanelHeading title="Resolved concerns" meta={`${resolvedConcerns.length} resolved`} />
            <Table heads={concernHeads} rows={concernRows(resolvedConcerns)} />
          </div>
        </div>
      </section>}
      <nav className="librarian-footer-tabs" aria-label="Librarian dashboard sections">
        <button className={activeSection === "seats" ? "active" : ""} onClick={() => setActiveSection("seats")}>
          <span className="tab-icon" aria-hidden="true">▦</span><span className="tab-label">Seat map</span>
        </button>
        <button className={activeSection === "assign" ? "active" : ""} onClick={() => setActiveSection("assign")}>
          <span className="tab-icon" aria-hidden="true">↔</span><span className="tab-label">Assign seats</span>
        </button>
        <button className={activeSection === "payment" ? "active" : ""} onClick={() => setActiveSection("payment")}>
          <span className="tab-icon" aria-hidden="true">₹</span><span className="tab-label">Record payment</span>
        </button>
        <button className={activeSection === "concerns" ? "active" : ""} onClick={() => setActiveSection("concerns")}>
          <span className="tab-icon" aria-hidden="true">✋</span><span className="tab-label">Concerns</span>
        </button>
      </nav>
    </Dashboard>
  );
}
function Select({
  value,
  set,
  label,
  options,
}: {
  value?: string;
  set: (x: string) => void;
  label: string;
  options: string[][];
}) {
  return (
    <select required value={value || ""} onChange={(e) => set(e.target.value)}>
      <option value="">{label}</option>
      {options.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}

function SearchableSelect({
  value,
  set,
  label,
  options,
}: {
  value?: string;
  set: (value: string) => void;
  label: string;
  options: string[][];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find(([optionValue]) => optionValue === value);
  const filteredOptions = options.filter(([, text]) =>
    text.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="searchable-select">
      <input
        required
        readOnly
        value={selected?.[1] || ""}
        placeholder={label}
        aria-label={label}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="searchable-select-menu">
          <input
            autoFocus
            type="search"
            value={search}
            placeholder="Search student..."
            aria-label="Search student options"
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="searchable-select-options">
            {filteredOptions.length ? filteredOptions.map(([optionValue, text]) => (
              <button
                type="button"
                className={optionValue === value ? "selected" : ""}
                key={optionValue}
                onClick={() => {
                  set(optionValue);
                  setSearch("");
                  setOpen(false);
                }}
              >
                {text}
              </button>
            )) : <span className="searchable-select-empty">No students found</span>}
          </div>
        </div>
      )}
      {open && <button type="button" className="searchable-select-backdrop" aria-label="Close student options" onClick={() => setOpen(false)} />}
    </div>
  );
}
type StudyGoal = { id: string; date: string; title: string; completed: boolean };
type StickyNote = { id: string; text: string; color: string };
const noteColors = ["yellow", "pink", "blue", "green", "lavender"];

const getToday = () => {
  const date = new Date();
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

function Student({ token }: { token: string }) {
  const [activeSection, setActiveSection] = useState<"seat" | "payment" | "concerns" | "goals">("seat");
  const [data, setData] = useState<any>(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [goalDate, setGoalDate] = useState(getToday),
    [goalTitle, setGoalTitle] = useState(""),
    [goals, setGoals] = useState<StudyGoal[]>([]),
    [goalsLoaded, setGoalsLoaded] = useState(false),
    [noteText, setNoteText] = useState(""),
    [noteColor, setNoteColor] = useState(noteColors[0]),
    [notes, setNotes] = useState<StickyNote[]>([]),
    [notesLoaded, setNotesLoaded] = useState(false),
    [timerSeconds, setTimerSeconds] = useState(45 * 60),
    [timerRunning, setTimerRunning] = useState(false);
  const load = async () => {
    try {
      setData(await api("/students/me", "GET", undefined, token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load");
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!data?.student?._id) return;
    const savedGoals = localStorage.getItem(`studyGoals:${data.student._id}`);
    if (savedGoals) {
      const parsedGoals = JSON.parse(savedGoals) as Partial<StudyGoal>[];
      setGoals(parsedGoals.map((goal) => ({
        id: goal.id || crypto.randomUUID(),
        date: goal.date || getToday(),
        title: goal.title || "Untitled goal",
        completed: Boolean(goal.completed),
      })));
    }
    setGoalsLoaded(true);
    const savedNotes = localStorage.getItem(`stickyNotes:${data.student._id}`);
    if (savedNotes) setNotes(JSON.parse(savedNotes) as StickyNote[]);
    setNotesLoaded(true);
  }, [data?.student?._id]);
  useEffect(() => {
    if (!data?.student?._id || !goalsLoaded) return;
    localStorage.setItem(`studyGoals:${data.student._id}`, JSON.stringify(goals));
  }, [data?.student?._id, goals, goalsLoaded]);
  useEffect(() => {
    if (!data?.student?._id || !notesLoaded) return;
    localStorage.setItem(`stickyNotes:${data.student._id}`, JSON.stringify(notes));
  }, [data?.student?._id, notes, notesLoaded]);
  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      setTimerSeconds((seconds) => {
        if (seconds <= 1) {
          setTimerRunning(false);
          notifySuccess("Study session complete. Take a short break.");
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);
  if (!data)
    return (
      <Dashboard
        title="Loading your space"
        subtitle="Just a moment..."
        error={error}
      />
    );
  const payment = data.payments?.[0];
  const send = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/concerns", "POST", { message }, token);
      setMessage("");
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not send concern");
    }
  };
  const addGoal = (e: FormEvent) => {
    e.preventDefault();
    const title = goalTitle.trim();
    if (!title) return;
    setGoals([...goals, { id: crypto.randomUUID(), date: goalDate, title, completed: false }]);
    setGoalTitle("");
  };
  const toggleGoal = (id: string) => {
    setGoals(goals.map((goal) => goal.id === id ? { ...goal, completed: !goal.completed } : goal));
  };
  const deleteGoal = (id: string) => {
    setGoals(goals.filter((goal) => goal.id !== id));
  };
  const goalsForDate = goals.filter((goal) => goal.date === goalDate);
  const addNote = (e: FormEvent) => {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setNotes([{ id: crypto.randomUUID(), text, color: noteColor }, ...notes]);
    setNoteText("");
  };
  const deleteNote = (id: string) => setNotes(notes.filter((note) => note.id !== id));
  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const seconds = String(timerSeconds % 60).padStart(2, "0");
  return (
    <Dashboard
      title={`Welcome, ${data.student.name}`}
      subtitle={`Your library: ${data.student.library?.name || "LibraryHub"}`}
      kicker="STUDENT SPACE"
      error={error}
    >
      {activeSection === "seat" && <div className="student-grid">
        <section className="panel feature-panel">
          <PanelHeading title="Your seat" meta="Current assignment" />
          <p className="seat-number">
            {data.seat?.seatNumber || "Not assigned yet"}
          </p>
          <p className="muted">Your place is ready when you are.</p>
        </section>
        <section className="panel">
          <PanelHeading title="Last payment" meta="Most recent" />
          {payment ? (
            <>
              <p className="amount">₹{payment.amount}</p>
              <p className="muted">
                {new Date(payment.paidAt).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="muted">No payment recorded yet.</p>
          )}
        </section>
      </div>}
      {activeSection === "payment" && <section className="panel">
        <PanelHeading
          title="Payment history"
          meta={`${data.payments.length} records`}
        />
        <Table
          heads={["Amount", "Paid date"]}
          rows={data.payments.map((p: any) => [
            `₹${p.amount}`,
            new Date(p.paidAt).toLocaleDateString(),
          ])}
        />
      </section>}
      {activeSection === "concerns" && (data.seat ? (
        <section className="panel concern-panel">
          <PanelHeading title="Need a hand?" meta="Message your librarian" />
          <form className="concern-form" onSubmit={send}>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell your librarian what you need..."
            />
            <button className="primary small">
              Raise concern <span>✋</span>
            </button>
          </form>
        </section>
      ) : (
        <section className="panel concern-panel access-note">
          <PanelHeading title="Seat assignment pending" meta="Access limited" />
          <p className="muted">Community access and concerns become available after a librarian assigns your seat.</p>
        </section>
      ))}
      {activeSection === "goals" && <section className="panel study-panel">
        <PanelHeading
          title="Study goals"
          meta={`${goalsForDate.filter((goal) => goal.completed).length}/${goalsForDate.length} complete`}
        />
        <div className="study-tools">
          <div className={`focus-timer ${timerRunning ? "is-running" : ""}`}>
            <p className="eyebrow">FOCUS SESSION</p>
            <strong>{minutes}:{seconds}</strong>
            <div className="timer-actions">
              <button className="primary small" onClick={() => setTimerRunning(!timerRunning)}>
                {timerRunning ? "Pause" : "Start"} <span>{timerRunning ? "Ⅱ" : "▶"}</span>
              </button>
              <button className="outline small" onClick={() => { setTimerRunning(false); setTimerSeconds(45 * 60); }}>
                Reset
              </button>
            </div>
          </div>
          <div className="goal-list">
            <form className="goal-form" onSubmit={addGoal}>
              <input
                required
                type="date"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                aria-label="Target date"
              />
              <input
                required
                maxLength={120}
                placeholder="Add today's target"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
              />
              <button className="outline small">Add goal</button>
            </form>
            {goalsForDate.length ? goalsForDate.map((goal) => (
              <label className={`study-goal ${goal.completed ? "completed" : ""}`} key={goal.id}>
                <input type="checkbox" checked={goal.completed} onChange={() => toggleGoal(goal.id)} />
                <span>{goal.title}</span>
                <button type="button" className="study-goal-delete" onClick={() => deleteGoal(goal.id)} aria-label={`Delete ${goal.title}`} title="Delete target">
                  ×
                </button>
              </label>
            )) : <p className="muted">Set a target for this date and make a start.</p>}
          </div>
        </div>
        <div className="sticky-notes">
          <div className="sticky-notes-heading">
            <div>
              <p className="eyebrow">QUICK NOTES</p>
              <h3>Keep useful thoughts close</h3>
            </div>
            <span className="sticky-notes-count">{notes.length} notes</span>
          </div>
          <form className="sticky-note-form" onSubmit={addNote}>
            <textarea
              required
              maxLength={280}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a useful reminder, quote or idea..."
            />
            <div className="sticky-note-actions">
              <div className="note-colors" aria-label="Choose note color">
                {noteColors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={`note-color ${color} ${noteColor === color ? "selected" : ""}`}
                    onClick={() => setNoteColor(color)}
                    aria-label={`${color} note`}
                    title={`${color} note`}
                  />
                ))}
              </div>
              <button className="primary small">Add note <span>＋</span></button>
            </div>
          </form>
          {notes.length ? (
            <div className="sticky-note-grid">
              {notes.map((note) => (
                <article className={`sticky-note ${note.color}`} key={note.id}>
                  <button className="sticky-note-delete" type="button" onClick={() => deleteNote(note.id)} aria-label="Delete note" title="Delete note">×</button>
                  <p>{note.text}</p>
                </article>
              ))}
            </div>
          ) : <p className="muted">Pin a thought here so it stays easy to find.</p>}
        </div>
      </section>}
      <nav className="librarian-footer-tabs student-footer-tabs" aria-label="Student dashboard sections">
        <button className={activeSection === "seat" ? "active" : ""} onClick={() => setActiveSection("seat")}>
          <span className="tab-icon" aria-hidden="true">▦</span><span className="tab-label">My seat</span>
        </button>
        <button className={activeSection === "payment" ? "active" : ""} onClick={() => setActiveSection("payment")}>
          <span className="tab-icon" aria-hidden="true">₹</span><span className="tab-label">Payments</span>
        </button>
        <button className={activeSection === "concerns" ? "active" : ""} onClick={() => setActiveSection("concerns")}>
          <span className="tab-icon" aria-hidden="true">✋</span><span className="tab-label">Concerns</span>
        </button>
        <button className={activeSection === "goals" ? "active" : ""} onClick={() => setActiveSection("goals")}>
          <span className="tab-icon" aria-hidden="true">◷</span><span className="tab-label">Study goals</span>
        </button>
      </nav>
    </Dashboard>
  );
}
function CommunicationPortal({
  token,
  role,
}: {
  token: string;
  role: "STUDENT" | "LIBRARIAN";
}) {
  const [posts, setPosts] = useState<any[]>([]),
    [notices, setNotices] = useState<any[]>([]),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [noticeTitle, setNoticeTitle] = useState(""),
    [noticeContent, setNoticeContent] = useState(""),
    [comments, setComments] = useState<Record<string, string>>({}),
    [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({}),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const [a, b] = await Promise.all([
        api("/communication/posts", "GET", undefined, token),
        api("/communication/notices", "GET", undefined, token),
      ]);
      setPosts(a);
      setNotices(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load community");
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token } });
    const normalizePost = (post: any) => ({
      ...post,
      likesCount: post.likesCount ?? post.likes?.length ?? 0,
      likedByMe: post.likedByMe ?? false,
    });
    socket.on("post:created", (post: any) => {
      setPosts((current) => [
        normalizePost(post),
        ...current.filter((item) => item._id !== post._id),
      ]);
    });
    socket.on("post:updated", ({ post }: { post: any }) => {
      setPosts((current) => current.map((item) => (
        item._id === post._id
          ? { ...normalizePost(post), likedByMe: item.likedByMe }
          : item
      )));
    });
    socket.on("post:deleted", ({ postId }: { postId: string }) => {
      setPosts((current) => current.filter((post) => post._id !== postId));
    });
    socket.on("notice:created", (notice: any) => {
      setNotices((current) => [notice, ...current.filter((item) => item._id !== notice._id)]);
    });
    socket.on("notice:deleted", ({ noticeId }: { noticeId: string }) => {
      setNotices((current) => current.filter((notice) => notice._id !== noticeId));
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);
  const createPost = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/communication/posts", "POST", { title, content }, token);
      setTitle("");
      setContent("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish post");
    }
  };
  const addComment = async (e: FormEvent, postId: string) => {
    e.preventDefault();
    try {
      await api(
        `/communication/posts/${postId}/comments`,
        "POST",
        { message: comments[postId] },
        token,
      );
      setComments({ ...comments, [postId]: "" });
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not add comment");
    }
  };
  const toggleLike = async (postId: string) => {
    try {
      await api(`/communication/posts/${postId}/like`, "PATCH", {}, token);
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not update like");
    }
  };
  const createNotice = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(
        "/communication/notices",
        "POST",
        { title: noticeTitle, content: noticeContent },
        token,
      );
      setNoticeTitle("");
      setNoticeContent("");
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not publish notice");
    }
  };
  const remove = async (path: string) => {
    try {
      await api(path, "DELETE", undefined, token);
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not remove item");
    }
  };
  const toggleComments = (postId: string) => {
    setExpandedComments((current) => ({
      ...current,
      [postId]: !current[postId],
    }));
  };
  return (
    <section className="communication">
      <div className="community-heading">
        <div>
          <p className="eyebrow">LIBRARY COMMUNITY</p>
          <h2>Ideas, updates and useful finds.</h2>
          <p className="muted">
            Share knowledge with the people who study alongside you.
          </p>
        </div>
        <span className="community-mark">✦</span>
      </div>
      <div className="communication-grid">
        <div className="feed-column">
          {role === "STUDENT" && (
            <form className="post-composer" onSubmit={createPost}>
              <p className="composer-label">SHARE SOMETHING USEFUL</p>
              <input
                required
                maxLength={120}
                placeholder="Give your post a title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                required
                maxLength={2000}
                placeholder="What would you like the community to know?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <button className="primary small">
                Publish post <span>↗</span>
              </button>
            </form>
          )}
          <div className="post-feed" aria-label="Community posts">
            {posts.length ? (
              posts.map((post) => (
              <article className="post-card" key={post._id}>
                <div className="post-meta">
                  <span className="avatar">
                    {post.author?.name?.charAt(0) || "S"}
                  </span>
                  <span>
                    <strong>{post.author?.name || "Student"}</strong>
                    <small>
                      {formatDateTime(post.createdAt)}
                    </small>
                  </span>
                  {role === "LIBRARIAN" && (
                    <button
                      className="moderate-action"
                      onClick={() => remove(`/communication/posts/${post._id}`)}
                    >
                      Delete post
                    </button>
                  )}
                </div>
                <h3>{post.title}</h3>
                <p>{post.content}</p>
                <div className="post-actions">
                  <button
                    className={`like-button ${post.likedByMe ? "liked" : ""}`}
                    onClick={() => toggleLike(post._id)}
                      aria-pressed={Boolean(post.likedByMe)}
                  >
                      <span className="like-icon" aria-hidden="true">{post.likedByMe ? "♥" : "♡"}</span>
                      <span>{post.likesCount || 0} likes</span>
                  </button>
                  <button
                    type="button"
                    className="comments-toggle"
                    onClick={() => toggleComments(post._id)}
                    aria-expanded={Boolean(expandedComments[post._id])}
                  >
                    <span className="comments-icon" aria-hidden="true">💬</span>{" "}
                    {expandedComments[post._id] ? "Hide" : "Show"} {post.comments?.length || 0} comments
                  </button>
                </div>
                {expandedComments[post._id] && <div className="comments">
                  {post.comments?.map((comment: any) => (
                    <div className="comment" key={comment._id}>
                      <span className="avatar tiny">
                        {comment.author?.name?.charAt(0) || "S"}
                      </span>
                      <p>
                        <strong>
                          {comment.author?.name || "Student"}
                          <small
                            className="comment-relative-time"
                            title={formatDateTime(comment.createdAt)}
                          >
                            {formatRelativeTime(comment.createdAt)}
                          </small>
                        </strong>
                        {comment.message}
                      </p>
                      {role === "LIBRARIAN" && (
                        <button
                          className="comment-delete"
                          onClick={() =>
                            remove(
                              `/communication/posts/${post._id}/comments/${comment._id}`,
                            )
                          }
                          aria-label="Delete comment"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {role === "STUDENT" && (
                    <form
                      className="comment-form"
                      onSubmit={(e) => addComment(e, post._id)}
                    >
                      <input
                        required
                        placeholder="Add a thoughtful comment..."
                        value={comments[post._id] || ""}
                        onChange={(e) =>
                          setComments({
                            ...comments,
                            [post._id]: e.target.value,
                          })
                        }
                      />
                      <button className="outline small">Comment</button>
                    </form>
                  )}
                </div>}
                </article>
              ))
            ) : (
              <div className="empty-state">
                <strong>The community is quiet.</strong>
                <span>Be the first to share something worth knowing.</span>
              </div>
            )}
          </div>
        </div>
        <aside className="notice-board">
          <div className="notice-board-heading">
            <div>
              <p className="eyebrow">NOTICE BOARD</p>
              <h2>From your librarian</h2>
            </div>
            <span>⌁</span>
          </div>
          {notices.length ? (
            notices.map((notice) => (
              <article className="notice-card" key={notice._id}>
                <div>
                  <h3>{notice.title}</h3>
                  <p>{notice.content}</p>
                  <small>
                    {formatDateTime(notice.createdAt)}
                  </small>
                </div>
                {role === "LIBRARIAN" && (
                  <button
                    className="comment-delete"
                    onClick={() =>
                      remove(`/communication/notices/${notice._id}`)
                    }
                    aria-label="Delete notice"
                  >
                    ×
                  </button>
                )}
              </article>
            ))
          ) : (
            <p className="muted">No notices yet.</p>
          )}
          {role === "LIBRARIAN" && (
            <form className="notice-composer" onSubmit={createNotice}>
              <p className="composer-label">POST A NOTICE</p>
              <input
                required
                maxLength={120}
                placeholder="Notice title"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
              />
              <textarea
                required
                maxLength={2000}
                placeholder="Write the notice..."
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
              />
              <button className="primary small">
                Attach notice <span>↗</span>
              </button>
            </form>
          )}
        </aside>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
function Dashboard({
  title,
  subtitle,
  kicker,
  error,
  children,
}: {
  title: string;
  subtitle: string;
  kicker?: string;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <section className="dashboard page-enter">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">{kicker || "DASHBOARD"}</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="live-status">
          <span /> Live workspace
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {children}
    </section>
  );
}
function PanelHeading({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      <span>{meta}</span>
    </div>
  );
}
function Stat({
  n,
  t,
  icon,
  accent,
}: {
  n: number;
  t: string;
  icon: string;
  accent?: string;
}) {
  return (
    <div className={`stat ${accent || ""}`}>
      <span className="stat-icon">{icon}</span>
      <strong>{n}</strong>
      <span className="stat-label">{t}</span>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return <span className={`status ${value.toLowerCase()}`}>{value}</span>;
}
function Table({ heads, rows }: { heads: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={heads.length}>No records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export default App;
