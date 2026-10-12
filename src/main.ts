import { mount } from 'svelte';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './app.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
