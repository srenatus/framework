import {compileString} from "squint-cljs";

export function transpileSquint(input: string): string {
  return compileString(input, {
    context: "expr",
    "elide-exports": true
  }).replace("squint-cljs/core.js", "npm:squint-cljs/core.js");
}
