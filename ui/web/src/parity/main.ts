import { mount } from "svelte";
import "../../../../src/app.css";
import "$ui/styles/tokens.css";
import ParityPage from "./ParityPage.svelte";

mount(ParityPage, { target: document.getElementById("app") as HTMLElement });
