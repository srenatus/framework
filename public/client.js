import {Runtime, Library, Inspector} from "npm:@observablehq/runtime";

const library = Object.assign(new Library(), {width});
const runtime = new Runtime(library);
const main = runtime.module();

const attachedFiles = new Map();
const resolveFile = (name) => attachedFiles.get(name);
main.builtin("FileAttachment", runtime.fileAttachments(resolveFile));

const variablesById = new Map();
const Generators = library.Generators;

function width() {
  return Generators.observe((notify) => {
    let width;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w !== width) notify((width = w));
    });
    observer.observe(document.querySelector("main"));
    return () => observer.disconnect();
  });
}

export function define({id, inline, inputs = [], outputs = [], files = [], body}) {
  id = String(id);
  const variables = [];
  variablesById.get(id)?.forEach((v) => v.delete());
  variablesById.set(id, variables);
  const root = document.querySelector(`#cell-${id}`);
  const observer = {pending: () => (root.innerHTML = ""), rejected: (error) => new Inspector(root).rejected(error)};
  const display = inline
    ? (val) => (val instanceof Node || typeof val === "string" || !val?.[Symbol.iterator] ? root.append(val) : root.append(...val), val) // prettier-ignore
    : (val) => (new Inspector(root.appendChild(document.createElement("SPAN"))).fulfilled(val), val);
  const v = main.variable(observer, {
    shadow: {
      display: () => display,
      view: () => (val) => Generators.input(display(val))
    }
  });
  v.define(outputs.length ? `cell ${id}` : null, inputs, body);
  variables.push(v);
  for (const o of outputs) variables.push(main.define(o, [`cell ${id}`], (exports) => exports[o]));
  for (const f of files) attachedFiles.set(f.name, {url: String(new URL(`/_file/${f.name}`, location)), mimeType: f.mimeType}); // prettier-ignore
}

export function open({hash} = {}) {
  const socket = new WebSocket(Object.assign(new URL("/_observablehq", location.href), {protocol: "ws"}));

  socket.onopen = () => {
    console.info("socket open");
    send({type: "hello", path: location.pathname, hash});
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.info("↓", message);
    switch (message.type) {
      case "reload": {
        location.reload();
        break;
      }
      case "update": {
        const root = document.querySelector("main");
        if (root.children.length !== message.length) {
          console.log("contents out of sync");
          location.reload();
          break;
        }
        message.diff.forEach(({type, newPos, oldPos, items}) => {
          switch (type) {
            case "add":
              items.forEach((item) => {
                switch (item.type) {
                  case "html":
                    if (root.children.length === 0) {
                      var template = document.createElement("template");
                      template.innerHTML = item.html;
                      root.appendChild(template.content.firstChild);
                    }
                    if (newPos >= root.children.length) {
                      root.children[root.children.length - 1].insertAdjacentHTML("afterend", item.html);
                    } else {
                      root.children[newPos++].insertAdjacentHTML("beforebegin", item.html);
                    }
                    // TODO: update inline cells in this item
                    break;
                  case "cell":
                    {
                      define({
                        id: item.id,
                        inline: item.inline,
                        inputs: item.inputs,
                        outputs: item.outputs,
                        files: item.files,
                        body: (0, eval)(item.body)
                      });
                    }
                    break;
                }
              });
              break;
            case "remove":
              items.forEach((item) => {
                switch (item.type) {
                  case "html":
                    if (oldPos < root.children.length) {
                      root.removeChild(root.children[oldPos]);
                    } else {
                      console.log("remove out of range", item);
                    }
                    break;
                  case "cell":
                    {
                      variablesById.get(item.id)?.forEach((v) => v.delete());
                      variablesById.delete(item.id);
                    }
                    break;
                }
              });
              break;
          }
        });
        break;
      }
    }
  };

  socket.onerror = (error) => {
    console.error(error);
  };

  socket.onclose = () => {
    console.info("socket close");
  };

  function send(message) {
    console.info("↑", message);
    socket.send(JSON.stringify(message));
  }
}
