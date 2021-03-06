
const HOSTED_URLS = {
  model:
      'model_js/model.json',
  metadata:
      'model_js/metadata.json'
};

const examples = {
  'example1':
      '_That_ is my idea of good breeding; and those persons who fancy themselves very important, and never open their mouths, quite mistake the matter.” “Did Charlotte dine with you?” “No, she would go home',
  'example2':
      'I wished to see him again, that I might wreak the utmost extent of abhorrence on his head and avenge the deaths of William and Justine',
  'example3':
      'I observed with assumed innocence that no man was safe from trouble in this world'      
};

function status(statusText) {
  console.log(statusText);
  document.getElementById('status').textContent = statusText;
}

function showMetadata(metadataJSON) {
  document.getElementById('vocabularySize').textContent =
      metadataJSON['vocabulary_size'];
  document.getElementById('maxLen').textContent =
      metadataJSON['max_len'];
}

function settextField(text, predict) {
  const textField = document.getElementById('text-entry');
  textField.value = text;
  doPredict(predict);
}

function setPredictFunction(predict) {
  const textField = document.getElementById('text-entry');
  textField.addEventListener('input', () => doPredict(predict));
}

function disableLoadModelButtons() {
  document.getElementById('load-model').style.display = 'none';
}

function doPredict(predict) {
  const textField = document.getElementById('text-entry');
  const result = predict(textField.value);
  score_string = "Class scores: ";
  for (var x in result.score) {
    score_string += x + " ->  " + result.score[x].toFixed(3) + ", "
  }
  //console.log(score_string);
  status(
      score_string + ' elapsed: ' + result.elapsed.toFixed(3) + ' ms)');
}

function prepUI(predict) {
  setPredictFunction(predict);
  const testExampleSelect = document.getElementById('example-select');
  testExampleSelect.addEventListener('change', () => {
    settextField(examples[testExampleSelect.value], predict);
  });
  settextField(examples['example1'], predict);
}

async function urlExists(url) {
  status('Testing url ' + url);
  try {
    const response = await fetch(url, {method: 'HEAD'});
    return response.ok;
  } catch (err) {
    return false;
  }
}

async function loadHostedPretrainedModel(url) {
  status('Loading pretrained model from ' + url);
  try {
    const model = await tf.loadModel(url);
    status('Done loading pretrained model.');
    disableLoadModelButtons();
    return model;
  } catch (err) {
    console.error(err);
    status('Loading pretrained model failed.');
  }
}

async function loadHostedMetadata(url) {
  status('Loading metadata from ' + url);
  try {
    const metadataJson = await fetch(url);
    const metadata = await metadataJson.json();
    status('Done loading metadata.');
    return metadata;
  } catch (err) {
    console.error(err);
    status('Loading metadata failed.');
  }
}

class Classifier {

  async init(urls) {
    this.urls = urls;
    this.model = await loadHostedPretrainedModel(urls.model);
    await this.loadMetadata();
    return this;
  }

  async loadMetadata() {
    const metadata =
        await loadHostedMetadata(this.urls.metadata);
    showMetadata(metadata);
    this.maxLen = metadata['max_len'];
    // also load vocab size
    this.vocabSize = metadata['vocabulary_size'];

    console.log('maxLen = ' + this.maxLen);

    this.wordIndex = metadata['word_index']
  }

  predict(text) {
    // Convert to lower case and remove all punctuations.
    var inputText =
        text.trim().toLowerCase().replace(/(\.|\,|\!|\_|\;)/g, '').split(' ');
    // console.log(inputText)
    // ADDED: only get the last this.maxLen elements from the text, if text
    // exceeds this.maxLen
    if (inputText.length > this.maxLen){
        inputText = inputText.slice((inputText.length - this.maxLen), inputText.length)
    }

    // Look up word indices.
    const inputBuffer = tf.buffer([1, this.maxLen], 'float32');

    var idx_current = 0

    for (let i = 0; i < inputText.length; ++i) {
      const word = inputText[i];

      const idx_word = this.wordIndex[word]

      // ADDED: only add the word if index is within the vocabulary size
      if (idx_word <= this.vocabSize){
        inputBuffer.set(idx_word, 0, idx_current);
        idx_current++
        // console.log(word, this.wordIndex[word], inputBuffer);
      }
    }
    // console.log(inputBuffer)
    const input = inputBuffer.toTensor();
    console.log(input.toString());

    status('Running inference');
    const beginMs = performance.now();
    const predictOut = this.model.predict(input);
    // console.log(predictOut.dataSync());
    const score = predictOut.dataSync();//[0];
    predictOut.dispose();
    const endMs = performance.now();

    return {score: score, elapsed: (endMs - beginMs)};
  }
};

async function setup() {
  if (await urlExists(HOSTED_URLS.model)) {
    status('Model available: ' + HOSTED_URLS.model);
    const button = document.getElementById('load-model');
    button.addEventListener('click', async () => {
      const predictor = await new Classifier().init(HOSTED_URLS);
      prepUI(x => predictor.predict(x));
    });
    button.style.display = 'inline-block';
  }

  status('Standing by.');
}

setup();
