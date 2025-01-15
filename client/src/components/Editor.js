import React, { useEffect, useRef, useState } from "react";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
import { ACTIONS } from "../Actions";
import { toast } from "react-hot-toast";

function Editor({ socketRef, roomId, onCodeChange, username }) {
  const editorRef = useRef(null);
  const [fileContent, setFileContent] = useState("");

  useEffect(() => {
    const init = async () => {
      const editor = CodeMirror.fromTextArea(document.getElementById("realtimeEditor"), {
        mode: { name: "javascript", json: true },
        theme: "dracula",
        autoCloseTags: true,
        autoCloseBrackets: true,
        lineNumbers: true,
      });

      // for sync the code
      editorRef.current = editor;

      editor.setSize(null, "100%");
      editorRef.current.on("change", (instance, changes) => {
        const { origin } = changes;
        const line = changes.from.line;
        const code = instance.getValue(); // code has value which we write
        onCodeChange(code);

        if (origin !== "setValue") {
          socketRef.current.emit(
            ACTIONS.CODE_CHANGE,
            {
              roomId,
              code,
              line,
              username,
            },
            (response) => {
              if (response) {
                toast.error("line is locked");
              }
            }
          );
        }
      });
    };

    init();
  }, []);

  // Handle file input change and load content into editor
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target.result;
        setFileContent(fileContent);
        editorRef.current.setValue(fileContent); // Set content to CodeMirror
        onCodeChange(fileContent); // Update parent component state
        socketRef.current.emit(
          ACTIONS.CODE_CHANGE,
          {
            roomId,
            fileContent,
           
            username,
          },
          (response) => {
            if (response) {
              toast.error("line is locked");
            }
          }
        );
      };
      reader.readAsText(file); // Read the file as text
    }
  };

  // Data receive from server
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null) {
          editorRef.current.setValue(code); // Sync the code with server changes
        }
      });
    }

    return () => {
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    };
  }, [socketRef.current]);

  return (
    <div style={{ height: "600px" }}>
      <input type="file" onChange={handleFileChange} />
      <textarea id="realtimeEditor" defaultValue={fileContent}></textarea>
    </div>
  );
}

export default Editor;
