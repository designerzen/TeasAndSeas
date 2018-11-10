var s;
var words = [];
var i = -1;


var threshold = 300; // Waiting time between words
var lastTime = 0;

var bg = 20; // Background colour
var textCol = 220; // Text colour

var paused = true;

function setup() {
    createCanvas(windowWidth, windowHeight);
    textSize(40);
    textAlign(CENTER);
    fill(textCol);
    background(bg);
    text("Abbey Road Hackathon 2018", width / 2, height / 2);
    noLoop();

    string2words();
}

function draw() {
	// Do nothing if paused
	if (paused) {
        return;
    }
    background(bg);
    wordRender(words[i]);
    // waiting
    if (millis() - lastTime > threshold) {
        i++;
        lastTime = millis();
    }
    // Reset at end of array
    if (i > words.length - 1) {
        i = 0;
    }
}

function string2words() {
    s = "THE CONTESTANT ACKNOWLEDGES AND AGREES THAT THE COMPANY AND THE SPONSORS DO NOT HAVE NOW, NOR SHALL HAVE IN THE FUTURE, ANY DUTY OR LIABILITY (DIRECT, INDIRECT OR OTHERWISE) WITH RESPECT TO THE INFRINGEMENT OR PROTECTION OF ANY COPYRIGHT AND/OR OTHER INTELLECTUAL PROPERTY RIGHTS IN AND TO CONTESTANTS CONTRIBUTION OR APP.";
    words = s.split(" ");
}

function wordRender(word, sentiment) {
    
    
    // Render words one by one
    text(word, width / 2, height / 2);
    
    
}

function keyPressed() {
    // Toggle pause on a key press
    paused = !paused;
    if (paused) {
        noLoop();
    } else loop();

    lastTime = millis();
}