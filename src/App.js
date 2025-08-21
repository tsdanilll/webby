import React, { useEffect, useMemo, useCallback, useState } from "react";
import "./index.css"; // styles below

const API_URL = "https://4lugw2l2ooxz2c6po5ytwycmru0myjsx.lambda-url.us-east-1.on.aws/";
const MAX_TASKS = 10;
const MAX_CHARS = 200;
const GRAY_BOX_WIDTH = 400;

function TaskList({ tasks, onRemove, onComplete }) {
  if (tasks.length === 0) {
    return <span className="muted center">No tasks yet.</span>;
  }
  return (
    <>
      {tasks.map((t) => (
        <div
          key={t.id}
          className="row"
          style={{
            opacity: t.is_done ? 0.6 : 1,
            textDecoration: t.is_done ? "line-through" : "none",
          }}
        >
          <span className="row-title">{t.title}</span>
          <div className="row-actions">
            {!t.is_done && (
              <button className="btn success" onClick={() => onComplete(t.id)}>
                Complete
              </button>
            )}
            <button className="btn danger" onClick={() => onRemove(t.id)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      // Incomplete first, then completed; newest first within each group
      data.sort((a, b) => (a.is_done === b.is_done ? b.id - a.id : a.is_done ? 1 : -1));
      setTasks(data);
    } catch (e) {
      console.error(e);
      alert("Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const incomplete = useMemo(() => tasks.filter((t) => !t.is_done), [tasks]);
  const completed = useMemo(() => tasks.filter((t) => t.is_done), [tasks]);
  const charsLeft = MAX_CHARS - input.length;

  const isAddDisabled =
    input.trim().length === 0 || incomplete.length >= MAX_TASKS || charsLeft < 0 || loading;

  const handleAdd = useCallback(async () => {
    const title = input.trim();
    if (!title || incomplete.length >= MAX_TASKS || charsLeft < 0) return;
    setLoading(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setInput("");
      await fetchTasks();
    } catch (e) {
      console.error(e);
      alert("Failed to add todo");
    } finally {
      setLoading(false);
    }
  }, [input, incomplete.length, charsLeft, fetchTasks]);

  const handleRemove = useCallback(
    async (id) => {
      setLoading(true);
      try {
        await fetch(API_URL + id, { method: "DELETE" });
        await fetchTasks();
      } catch (e) {
        console.error(e);
        alert("Failed to remove todo");
      } finally {
        setLoading(false);
      }
    },
    [fetchTasks]
  );

  const handleComplete = useCallback(
    async (id) => {
      setLoading(true);
      try {
        await fetch(API_URL + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_done: true }),
        });
        await fetchTasks();
      } catch (e) {
        console.error(e);
        alert("Failed to complete todo");
      } finally {
        setLoading(false);
      }
    },
    [fetchTasks]
  );

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div className="wrap">
      <h1>To-Do List</h1>

      <div className="input-row">
        <input
          type="text"
          value={input}
          maxLength={MAX_CHARS}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter a new task..."
          disabled={incomplete.length >= MAX_TASKS || loading}
        />
        <button className="btn" onClick={handleAdd} disabled={isAddDisabled}>
          Add task
        </button>
      </div>

      <div className="muted small">{charsLeft} characters left</div>

      <div className="panel" style={{ width: GRAY_BOX_WIDTH }}>
        <span className="count">
          <b>Tasks:</b> {incomplete.length} / {MAX_TASKS}
        </span>
      </div>

      <div className="panel list" style={{ width: GRAY_BOX_WIDTH }}>
        {loading ? (
          <span className="muted center">Loading...</span>
        ) : (
          <>
            <TaskList tasks={incomplete} onRemove={handleRemove} onComplete={handleComplete} />
            {completed.length > 0 && (
              <>
                <div className="divider">Completed</div>
                <TaskList tasks={completed} onRemove={handleRemove} onComplete={() => {}} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
