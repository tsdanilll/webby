import React, { useEffect, useState, useCallback, useMemo } from "react";
import { signedFetch } from "./aws"; // ← our IAM-signed fetch helper

// UI limits (keep in sync with backend validation if you change)
const MAX_TASKS = 10;
const MAX_CHARS = 200;

// Small helper to sort: incomplete first, then newest
const sortTasks = (a, b) => (a.is_done === b.is_done ? b.id - a.id : a.is_done ? 1 : -1);

function TaskList({ tasks, onRemove, onComplete, disabled }) {
  if (tasks.length === 0) {
    return <span style={{ color: "#888", textAlign: "center" }}>No tasks yet.</span>;
  }
  return (
    <>
      {tasks.map((task) => (
        <div
          key={task.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 0",
            borderBottom: "1px solid #e0e0e0",
            wordBreak: "break-word",
            opacity: task.is_done ? 0.6 : 1,
            textDecoration: task.is_done ? "line-through" : "none",
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>{task.title}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {!task.is_done && (
              <button
                onClick={() => onComplete(task.id)}
                disabled={disabled}
                style={btnStyle("#27ae60")}
                aria-label={`Complete ${task.title}`}
              >
                Complete
              </button>
            )}
            <button
              onClick={() => onRemove(task.id)}
              disabled={disabled}
              style={btnStyle("#e74c3c")}
              aria-label={`Remove ${task.title}`}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

const btnStyle = (bg) => ({
  color: "#fff",
  background: bg,
  border: "none",
  borderRadius: 6,
  padding: "8px 12px",
  cursor: "pointer",
});

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false); // health check
  const [error, setError] = useState("");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await signedFetch("GET", "/");
      data.sort(sortTasks);
      setTasks(data);
    } catch (err) {
      console.error("GET / failed:", err);
      setError("Failed to load todos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const charsLeft = MAX_CHARS - input.length;

  const incomplete = useMemo(() => tasks.filter((t) => !t.is_done).slice(0, MAX_TASKS), [tasks]);
  const completed = useMemo(() => tasks.filter((t) => t.is_done), [tasks]);

  const isAddDisabled =
    input.trim().length === 0 || incomplete.length >= MAX_TASKS || charsLeft < 0 || loading;

  const handleAdd = useCallback(async () => {
    const title = input.trim();
    if (!title || incomplete.length >= MAX_TASKS || charsLeft < 0) return;

    // optimistic UX
    const tempId = Math.max(0, ...tasks.map((t) => t.id)) + 1;
    const optimistic = [{ id: tempId, title, is_done: false }, ...tasks];
    setTasks(optimistic);
    setInput("");

    try {
      await signedFetch("POST", "/", { title });
      await fetchTasks(); // re-sync with server
    } catch (err) {
      console.error("POST / failed:", err);
      setTasks(tasks); // rollback
      setError("Failed to add todo.");
    }
  }, [input, incomplete.length, charsLeft, tasks, fetchTasks]);

  const handleRemove = useCallback(
    async (id) => {
      const prev = tasks;
      setTasks(prev.filter((t) => t.id !== id));
      try {
        await signedFetch("DELETE", `/${id}`);
        await fetchTasks();
      } catch (err) {
        console.error("DELETE /:id failed:", err);
        setTasks(prev); // rollback
        setError("Failed to remove todo.");
      }
    },
    [tasks, fetchTasks]
  );

  const handleComplete = useCallback(
    async (id) => {
      const prev = tasks;
      setTasks(prev.map((t) => (t.id === id ? { ...t, is_done: true } : t)));
      try {
        await signedFetch("PATCH", `/${id}`, { is_done: true });
        await fetchTasks();
      } catch (err) {
        console.error("PATCH /:id failed:", err);
        setTasks(prev); // rollback
        setError("Failed to complete todo.");
      }
    },
    [tasks, fetchTasks]
  );

  const onKeyDown = (e) => e.key === "Enter" && handleAdd();

  const healthCheck = async () => {
    setChecking(true);
    setError("");
    try {
      const res = await signedFetch("GET", "/health");
      alert(`Health: ${res?.ok ? "OK" : "NOT OK"} ${res?.ok ? "" : JSON.stringify(res)}`);
    } catch (e) {
      console.error("GET /health failed:", e);
      setError("Health check failed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ margin: "0 auto", padding: 24, maxWidth: 560 }}>
      <h1 style={{ textAlign: "center", margin: "8px 0 16px" }}>To-do list</h1>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          maxLength={MAX_CHARS}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter a new task…"
          style={{
            flex: "1 1 260px",
            padding: 10,
            fontSize: 16,
            border: "1px solid #cfcfcf",
            borderRadius: 6,
            minWidth: 220,
          }}
          disabled={incomplete.length >= MAX_TASKS || loading}
          aria-label="New task"
        />
        <button
          onClick={handleAdd}
          disabled={isAddDisabled}
          style={{
            padding: "10px 16px",
            fontSize: 16,
            borderRadius: 6,
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Add task
        </button>
        <button
          onClick={healthCheck}
          disabled={checking}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            borderRadius: 6,
            border: "1px solid #cfcfcf",
            background: "#f7f7f7",
            cursor: "pointer",
          }}
          title="DB connectivity check"
        >
          {checking ? "Checking…" : "Health"}
        </button>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          color: charsLeft < 0 ? "red" : "#666",
          marginBottom: 8,
        }}
      >
        {charsLeft} characters left
      </div>

      {/* Counters */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          margin: "0 auto 8px",
          background: "#f0f0f0",
          borderRadius: 6,
          minHeight: 32,
          padding: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
        }}
      >
        Tasks: {incomplete.length} / {MAX_TASKS}
      </div>

      {/* List */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          margin: "0 auto 16px",
          background: "#f0f0f0",
          borderRadius: 6,
          minHeight: 48,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {error && (
          <div
            style={{
              background: "#ffe8e6",
              color: "#b0413e",
              border: "1px solid #f5c2c0",
              padding: 8,
              borderRadius: 6,
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <span style={{ color: "#888", textAlign: "center" }}>Loading…</span>
        ) : (
          <>
            <TaskList
              tasks={incomplete}
              onRemove={handleRemove}
              onComplete={handleComplete}
              disabled={loading}
            />
            {completed.length > 0 && (
              <>
                <div
                  style={{
                    borderTop: "1px solid #ccc",
                    margin: "8px 0 4px",
                    fontSize: 13,
                    color: "#888",
                    paddingTop: 6,
                  }}
                >
                  Completed
                </div>
                <TaskList
                  tasks={completed}
                  onRemove={handleRemove}
                  onComplete={() => {}}
                  disabled={loading}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
