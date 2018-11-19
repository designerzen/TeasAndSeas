// make sure we get this first ahead of everything!
import Tone from 'tone'

// EXPOSE Tone for the tweakers
window.Tone = Tone

import { init} from "./ui"

window.onload = ()=>{
    // go!    
    init()
}