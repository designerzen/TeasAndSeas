// https://www.chromestatus.com/features/5687444770914304

export const hasSpeech = () =>{
  return "speechSynthesis" in window
}

const getVoices = () =>{
  return window.speechSynthesis.getVoices()
}

const getSpecificVoice = (lang = "en-US", name ="Zira") =>{
  const voices = getVoices()
  const filtered = voices.filter( voice => {
    // first we check to see if the language is the same...
    return (voice.lang === lang && voice.name.indexOf(name) > -1 )
  })
  return filtered.length < 1 ? voices : filtered
}

////////////////////////////////////////////////////////////
// Speak this out loud
// rate     0.1 to 10
// pitch    0 to 2
////////////////////////////////////////////////////////////
export const say = (text, volume=1, rate=9, pitch=1, lang = "en-US", name = "Zira") =>{

  return new Promise( (resolve,reject)=>{

    if (!hasSpeech)
    {
      reject("Speech tech not available")

    }else{

      // now pause whilst we attempt to list...
      const talk = () => {

        const voices = getSpecificVoice(lang, name)

        if (voices.length < 1) {
          reject('No matching voice found')

        } else {

          const person = voices[0]

          const speech = new SpeechSynthesisUtterance()

          speech.lang = 'en-US'
          // set voice if specified
          // Note: some voices don't support altering params
          speech.voice = person
          speech.voiceURI = 'native';

          // watch for ending...
          speech.onend = (event) => {
            console.log('Finished in ' + event.elapsedTime + ' seconds.')
            speech.onend = null
            resolve(event)
          }

          // 0 to 1
          speech.volume = volume
          // 0.1 to 10
          speech.rate = rate
          //0 to 2
          speech.pitch = pitch
          speech.text = text


            console.error("specific voices", {
              speech, lang,
              name,
              voices
            });


          window.speechSynthesis.speak(speech)

        }
      }

      // in some ways this is a fudge factor as the voices
      // aren't always known about on DOM available
      setTimeout(talk,0)
    }
  })
}
