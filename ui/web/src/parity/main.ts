import { mount } from "svelte";
import "../../../../src/app.css";
import "$ui/styles/base.css";
import "$ui/styles/code.css";
import "$ui/styles/tokens.css";
import ParityPage from "./ParityPage.svelte";

mount(ParityPage, { target: document.getElementById("app") as HTMLElement });
