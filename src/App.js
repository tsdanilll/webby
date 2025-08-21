import React, { useEffect, useState, useCallback, useMemo } from "react";

// === AWS IAM AUTH IMPORTS ===
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-browser";

// === CONFIG ===
const AWS_REGION = "us-east-1"; // 🔹 your region
const IDENTITY_POOL_ID = "us-east-1:442221f0-0b04-4480-8a25-b086fd0f28e0"; // 🔹 your Cognito pool ID
const API_URL = "https://4lugw2l2ooxz2c6po5ytwycmru0myjsx.lambda-url.us-east-1.on.aws/"; // 🔹 your Lambda Function URL

// === SIGNED FETCH HELPER ===
const urlObj = new URL(API_URL);
const LAMBDA_HOSTNAME = urlObj.host;
const LAMBDA_PROTOCOL = urlObj.protocol;
const LAMBDA_BASEPATH = urlObj.pathname.endsWith("/")
  ? urlObj.pathname.slice(0, -1)
  : urlObj.pathname;

const credentialsProvider = fromCognitoIdentityPool({
  identityPoolId: IDENTITY_POOL_ID,
  clientConfig: { region: AWS_REGION },
});

const signer = new SignatureV4({
  service: "lambda",
  region: AWS_REGION,
  credentials: credentialsProvider,
  sha256: Sha256,
});

async function signedFetch(method, path = "/", bodyObj = null) {
  const norm = path.startsWith("/") ? path : `/${path}`;
  const fullPath = (LAMBDA_BASEPATH || "") + norm;
  const body = bodyObj ? JSON.stringify(bodyObj) : undefined;

  const signed = await signer.sign({
    method,
    protocol: LAMBDA_PROTOCOL,
    hostname: LAMBDA_HOSTNAME,
    path: fullPath || "/",
    headers: {
      host: LAMBDA_HOSTNAME,
      "content-type": body ? "application/json" : undefined,
    },
    body,
  });

  const res = await fetch(
    `${LAMBDA_PROTOCOL}//${LAMBDA_HOSTNAME}${fullPath || "/"}`,
    {
      method,
      headers: signed.headers,
      body,
    }
  );

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// === UI COMPONENTS ===
function TaskList({ tasks, onRemove, onComplete }) {
  if (tasks.length === 0) {
    return (
      <span style={{ color: "#888", textAlign: "center" }}>No tasks yet.</span>
    );
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
            padding: "4px 0",
            borderBottom: "1px solid #e0e0e0",
            wordBreak: "break-word",
            opacity: task.is_done ? 0.6 : 1,
            textDecoration: task.is_done ? "line-through" : "none",
          }}
        >
          <span style={{ flex: 1 }}>{task.title}</span>
          <div>
            {!task.is_done && (
              <button
                onClick={() => onComplete(task.id)}
                style={{
                  color: "white",
                  background: "#27ae60",
                  border: "none",
                  borderRadius: 4,
                  padding: "4px 12px",
                  cursor: "pointer",
                  marginLeft: 8,
                }}
              >
                Complete
              </button>
            )}
            <button
              onClick={() => onRemove(task.id)}
              style={{
                color: "white",
                background: "#e74c3c",
                border: "none",
                borderRadius: 4,
                padding: "4px 12px",
                cursor: "pointer",
                marginLeft: 8,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

// === MAIN APP ===
function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const MAX_TASKS = 10;
  const MAX_CHARS = 200;

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await signedFetch("GET", "/");
      data.sort((a, b) => {
        if (a.is_done === b.is_done) return b.id - a.id;
        return a.is_done ? 1 : -1;
      });
      setTasks(data);
    } catch (err) {
      console.error("Error fetching todos:", err);
      alert("Failed to load todos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const charsLeft = useMemo(() => MAX_CHARS - input.length, [input]);

  const incompleteTasks = useMemo(
    () => tasks.filter((t) => !t.is_done).slice(0, MAX_TASKS),
    [tasks]
  );
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.is_done),
    [tasks]
  );

  const isAddDisabled = useMemo(
    () =>
      input.trim().length === 0 ||
      incompleteTasks.length >= MAX_TASKS ||
      charsLeft < 0,
    [input, incompleteTasks.length, charsLeft]
  );

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleAddTask();
      }
    },
    [input, incompleteTasks.length, charsLeft]
  );

  const handleAddTask = useCallback(async () => {
    const trimmed = input.trim();
    if (trimmed && incompleteTasks.length < MAX_TASKS && charsLeft >= 0) {
      setLoading(true);
      try {
        await signedFetch("POST", "/", { title: trimmed });
        setInput("");
        await fetchTasks();
      } catch (err) {
        console.error("Error adding todo:", err);
        alert("Failed to add todo.");
      } finally {
        setLoading(false);
      }
    }
  }, [input, incompleteTasks.length, charsLeft, fetchTasks]);

  const handleRemoveTask = useCallback(
    async (id) => {
      setLoading(true);
      try {
        await signedFetch("DELETE", `/${id}`);
        await fetchTasks();
      } catch (err) {
        console.error("Error removing todo:", err);
        alert("Failed to remove todo.");
      } finally {
        setLoading(false);
      }
    },
    [fetchTasks]
  );

  const handleCompleteTask = useCallback(
    async (id) => {
      setLoading(true);
      try {
        await signedFetch("PATCH", `/${id}`, { is_done: true });
        await fetchTasks();
      } catch (err) {
        console.error("Error completing todo:", err);
        alert("Failed to complete todo.");
      } finally {
        setLoading(false);
      }
    },
    [fetchTasks]
  );

  return (
    <div style={{ maxWidth: 425, margin: "0 auto", padding: 40 }}>
      <h1>To-do list</h1>
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          maxLength={MAX_CHARS}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="Enter a new task..."
          style={{ width: "70%", padding: 8, fontSize: 16 }}
          disabled={incompleteTasks.length >= MAX_TASKS || loading}
        />
        <button
          onClick={handleAddTask}
          style={{ marginLeft: 8, padding: "8px 16px", fontSize: 16 }}
          disabled={isAddDisabled || loading}
        >
          Add task
        </button>
        <div
          style={{
            fontSize: 12,
            color: charsLeft < 0 ? "red" : "#888",
            marginTop: 4,
          }}
        >
          {charsLeft} characters left
        </div>
      </div>

      <div
        style={{
          width: 400,
          margin: "0 auto 8px auto",
          background: "#f0f0f0",
          borderRadius: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 32,
          padding: 8,
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: 16 }}>
          Tasks: {incompleteTasks.length} / {MAX_TASKS}
        </span>
      </div>

      <div
        style={{
          width: 400,
          margin: "0 auto 16px auto",
          background: "#f0f0f0",
          borderRadius: 4,
          minHeight: 32,
          padding: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent:
            incompleteTasks.length + completedTasks.length === 0
              ? "center"
              : "flex-start",
        }}
      >
        {loading ? (
          <span style={{ color: "#888", textAlign: "center" }}>Loading...</span>
        ) : (
          <>
            <TaskList
              tasks={incompleteTasks}
              onRemove={handleRemoveTask}
              onComplete={handleCompleteTask}
            />
            {completedTasks.length > 0 && (
              <>
                <div
                  style={{
                    borderTop: "1px solid #ccc",
                    margin: "8px 0 4px 0",
                    fontSize: 13,
                    color: "#888",
                  }}
                >
                  Completed
                </div>
                <TaskList
                  tasks={completedTasks}
                  onRemove={handleRemoveTask}
                  onComplete={() => {}}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
