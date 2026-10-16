import { mount } from "svelte";
import "../../../../src/app.css";
import "$ui/styles/tokens.css";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app") as HTMLElement });
