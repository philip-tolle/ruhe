import { mount } from 'svelte'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/nunito-sans'
import './app.css'
import App from './App.svelte'
import { initPwa } from './lib/pwa/update.svelte'

mount(App, { target: document.getElementById('app')! })

initPwa()
