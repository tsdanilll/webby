import React, { useState, useCallback, useMemo } from 'react';
import './App.css';

const MAX_TASKS = 10;
const MAX_CHARS = 200;
const GRAY_BOX_WIDTH = 400;

const TaskList = React.memo(function TaskList({ tasks, onRemove }) {
  if (tasks.length === 0) {
    return (
      <span style={{ color: '#888', textAlign: 'center' }}>No tasks yet.</span>
    );
  }
  return (
    <>
      {tasks.map(task => (
        <div
          key={task.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0',
            borderBottom: '1px solid #e0e0e0',
            wordBreak: 'break-word'
          }}
        >
          <span style={{ flex: 1 }}>{task.text}</span>
          <button
            onClick={() => onRemove(task.id)}
            style={{
              color: 'white',
              background: '#e74c3c',
              border: 'none',
              borderRadius: 4,
              padding: '4px 12px',
              cursor: 'pointer',
              marginLeft: 8
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </>
  );
});

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState('');

  const charsLeft = useMemo(() => MAX_CHARS - input.length, [input]);

  const handleAddTask = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && tasks.length < MAX_TASKS) {
      setTasks(prevTasks => [
        ...prevTasks,
        { id: Date.now(), text: trimmed }
      ]);
      setInput('');
    }
  }, [input, tasks.length]);

  const handleRemoveTask = useCallback((id) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
  }, []);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleAddTask();
    }
  }, [handleAddTask]);

  const isAddDisabled = useMemo(
    () => input.trim().length === 0 || tasks.length >= MAX_TASKS,
    [input, tasks.length]
  );

  return (
    <div className="App" style={{ maxWidth: 425, margin: '0 auto', padding: 40 }}>
      <h1>To-Do List</h1>
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          maxLength={MAX_CHARS}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="Enter a new task..."
          style={{ width: '70%', padding: 8, fontSize: 16 }}
          disabled={tasks.length >= MAX_TASKS}
        />
        <button
          onClick={handleAddTask}
          style={{ marginLeft: 8, padding: '8px 16px', fontSize: 16 }}
          disabled={isAddDisabled}
        >
          Add task
        </button>
        <div style={{ fontSize: 12, color: charsLeft < 0 ? 'red' : '#888', marginTop: 4 }}>
          {charsLeft} characters left
        </div>
      </div>
      {/* First gray box: task counter */}
      <div
        style={{
          width: GRAY_BOX_WIDTH,
          margin: '0 auto 8px auto',
          background: '#f0f0f0',
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 32,
          padding: 8,
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: 16 }}>
          Tasks: {tasks.length} / {MAX_TASKS}
        </span>
      </div>
      {/* Second gray box: list of tasks */}
      <div
        style={{
          width: GRAY_BOX_WIDTH,
          margin: '0 auto 16px auto',
          background: '#f0f0f0',
          borderRadius: 4,
          minHeight: 32,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: tasks.length === 0 ? 'center' : 'flex-start',
        }}
      >
        <TaskList tasks={tasks} onRemove={handleRemoveTask} />
      </div>
    </div>
  );
}
