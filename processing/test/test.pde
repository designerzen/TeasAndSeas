String s;
String[] words;
int i = 0;


int threshold = 300; // Waiting time between words
long lastTime = 0; 

int bg = 20; // Background colour
int textCol = 220; // Text colour

boolean paused = true;

void setup() {
  size(600, 400);
  textSize(40);
  textAlign(CENTER);
  fill(textCol);
  background(bg);
  text("Abbey Road Hackathon 2018", width/2, height/2);
  noLoop();

  string2words();
}

void draw() {
  wordRender();
}

void string2words() {
  s = "THE CONTESTANT ACKNOWLEDGES AND AGREES THAT THE COMPANY AND THE SPONSORS DO NOT HAVE NOW, NOR SHALL HAVE IN THE FUTURE, ANY DUTY OR LIABILITY (DIRECT, INDIRECT OR OTHERWISE) WITH RESPECT TO THE INFRINGEMENT OR PROTECTION OF ANY COPYRIGHT AND/OR OTHER INTELLECTUAL PROPERTY RIGHTS IN AND TO CONTESTANTS CONTRIBUTION OR APP.";
  words = s.split("\\W+");
}

void wordRender() {
  // Do nothing if paused
  if(paused){
    return;
  }
  // Render words one by one
  background(bg);
  text(words[i], width/2, height/2);
  if (millis() - lastTime > threshold) {
    i++;
    lastTime = millis();
  }
  // Reset at end of array
  if (i>words.length-1) {
    i = 0;
  }
}

void keyPressed() {
  // Toggle pause on a key press
  paused = !paused;
  if(paused){
  noLoop();
  } else loop();
  
  lastTime = millis();
}
