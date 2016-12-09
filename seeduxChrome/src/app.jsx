import React from 'react';
import * as fileSaver from 'file-saver';
import Graph from './components/Graph.jsx';
import D3Viz from './components/D3Viz';
import ParsingError from './components/ParsingError';
import ActionCreator from './components/ActionCreator';
import Log from './components/Log';
import Flash from './components/Flash';
import SettingsMenu from './components/SettingsMenu';
import getGreetings from './greetings';

function getPaddedMinutes(dateObj) {
  return dateObj.getMinutes() < 10 ? `0${dateObj.getMinutes()}` : dateObj.getMinutes();
}


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      settings: {
        containersViz: true,
        actionCreatorsViz: true,
        reducersViz: true,
        transactionLog: true
      },
      history: [],
      future: [],
      actionCreators: {},
      actionTypes: [],
      reducers: {},
      ui: {},
      chartType: 'comfyTree',
      flashMessage: getGreetings(),
    };
    // send a msg to the background script to ask for the current Log
    chrome.extension.sendMessage({type: 'populateLog'}, (response) => {
      console.log('Initial Log Population: ', response.history, response.future);
      this.setState({
        ui: response.codeObj.ui || {},
        actionCreators: response.codeObj.actionCreators || {},
        reducers: response.codeObj.reducers || {},
        actionTypes: response.codeObj.actionTypes || [],
        history: response.history,
        future: response.future,
      });
    });

    // add a listener for new log Entries from the content script
    chrome.runtime.onMessage.addListener((msg, sender, response) => {
      // msg from content script with new history entry
      if (msg.type === 'addToLog') {
        // add to our local copy of the log and update State,
        // discarding any existing future
        const newHistory = this.state.history;
        // console.log('Got New Entry!');
        newHistory.push(msg.historyEntry);
        this.setState({
          history: newHistory,
          future: [],
        });
      }
    });
  }
  resetLog() {
    // send a message to the background script to reset its history
    chrome.extension.sendMessage({type: 'resetLog'}, (response) => {
      console.log('Log Reset.');
      this.setState({
        future: [],
        history: [],
      });
    });
  }
  handleSelectChange(event) {
    this.setState({chartType: event.target.value})
  }
  createViz(data, name) {
    console.log('createVizdata: ', data);

    // Providing mapping object to allow for constant time look-up of setting booleans in state using headNode names

    const mapNodeNamesToSettings = {
      'Containers': 'containersViz',
      'Reducers': 'reducersViz',
      'Action Creators': 'actionCreatorsViz'
    }

    // If given setting boolean in state is false, return rather than displaying visualization or an error message

    if (!this.state.settings[mapNodeNamesToSettings[data.name]]) {
      return
    }

    // check if our code parsing data has come through.  if not, render a
    // friendly message.

    return (!data.children || !data.children.length) ?
      <ParsingError failureType={name} /> :
      <D3Viz data={data}
        chartType={this.state.chartType}
        searchTerm = { this.state.history.length ? this.state.history[this.state.history.length - 1].modifiedAction.type : null } />
  }
  stashLog() {
    localStorage.setItem('seeduxLog', JSON.stringify(this.state));
    console.log('Extension State Stashed.');
  }
  unStashLog() {
    if (localStorage.getItem('seeduxLog')) {
      const newState = Object.assign({}, JSON.parse(localStorage.getItem('seeduxLog')));
      console.log('Re-loading Extension State: ', newState);
      this.setState(newState);
    }
  }
  restore(direction, index) {
    // this is the 'brains' of the entire restore-state process; it determines what the newHistory
    // and newFuture should be, and sends them to the background script for storage.  The background script passes
    // just the 'new' i.e. restored state on to the content script -> seeduxLogger listener -> combineReducers listener route,
    // where it is returned as the app's next state, completing the restoration.
    let newHistory, newFuture;
    if (direction === 'past' && index >= 0) {
      newHistory = this.state.history.slice(0, index + 1);
      newFuture = this.state.history.slice(index + 1).concat(this.state.future);
    } else if (direction === 'future' && this.state.future.length) {
      newFuture = this.state.future.slice(index + 1);
      newHistory = this.state.history.concat(this.state.future.slice(0, index + 1));
    }
    if (newHistory && newFuture) chrome.extension.sendMessage({type: 'restoreFromTool', newHistory, newFuture }, (response) => {
      console.log('Restoring to index: ', index, ' from ', direction);
      console.log('new history: ', newHistory, ' new Future: ', newFuture);
      this.setState({
        history: newHistory,
        future: newFuture,
      });
    });
  }
  importLog(evt) {
    const file = evt.target.files[0];
    console.log('Got File: ', file);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readEvt) => {
      const readResult = JSON.parse(readEvt.target.result);
      const filename = 'seedux log';
      console.log('Read Log File: ', readResult);
      if (Object.keys(readResult).includes('chartType')) {
        const flashMessage = `Loaded ${filename}.`;
        this.setState({...readResult, flashMessage});
      }
      else this.flashMessage('Invalid Log File.');
    }
    reader.readAsText(file);
  }
  flashMessage(flashMessage) {
    this.setState(flashMessage);
  }
  exportLog() {
    // const dataURI = `data:application/octet-stream;charset=utf-u,${encodeURIComponent(JSON.stringify(this.state))}`;
    // const saveWindow = window.open(dataURI, 'Export Seedux Log');
    const now = new Date();
    const formattedDate = `${now.getMonth()}-${now.getDate()}-${now.getYear().toString().slice(1)} ${now.getHours()}-${getPaddedMinutes(now)}`;
    console.log('right now is ', formattedDate);
    const blob = new Blob([JSON.stringify(this.state, null, 2)], {type: "text/plain;charset=utf-8"});
    fileSaver.saveAs(blob, `seeduxLog ${formattedDate}.json`);
  }
  toggleSettings(e) {
    e.preventDefault();
    let changedSetting = e.target.id;
    let newSettingStatus = !this.state.settings[changedSetting];
    let newSettings = Object.assign({}, this.state.settings, { [changedSetting]: newSettingStatus } );
    this.setState({
      settings: newSettings
    });
  }
  render() {
    // retrieve latest diffs from our history
    let diffs = [];
    if (this.state.history.length) {
      diffs = this.state.history[this.state.history.length - 1].diffs;
    }
    // curry our restore function to provide individual button functionality
    const restoreFromHistory = (index) => this.restore('past', index);
    const restoreFromFuture = (index) => this.restore('future', index);
    const undo = () => this.restore('past', this.state.history.length - 2);
    const redo = () => this.restore('future', 0);

    // Check state for settings booleans to determine whether to render visualization select element or/and transaction log elements and component
    const vizSelectSetting = this.state.settings.containersViz || this.state.settings.actionCreatorsViz || this.state.settings.reducersViz ? { display: 'inline' } : { display: 'none' };
    const transactionLogSetting = this.state.settings.transactionLog ? { display: 'inline' } : { display: 'none'};

    return (
      <div>
        <Flash text={this.state.flashMessage} />
        <span>
          <SettingsMenu toggleSettings = {this.toggleSettings.bind(this)} settings = {this.state.settings}/>
        </span>
        <div className='chart-container'>
          {this.createViz(this.state.ui, 'UI Props')}
          {this.createViz(this.state.actionCreators, 'Action Creators')}
          {this.createViz(this.state.reducers, 'Reducers')}
        </div>
        <select value={this.state.value} onChange={this.handleSelectChange.bind(this)} style = { vizSelectSetting }>
          <option value="comfyTree">ComfyTree</option>
          <option value="cozyTree">CozyTree</option>
        </select>
        <div style = { transactionLogSetting }>
          <button onClick={() => this.resetLog()}>Reset Log</button>
          <button onClick={() => this.exportLog()}>Export Log</button>
          <input type="file" id="file" name="file" onChange={this.importLog.bind(this)} />
          <button onClick={() => this.stashLog()}>Stash Log</button>
          <button onClick={() => this.unStashLog()}>Unstash Log</button>
          <button onClick={undo}>Undo</button>
          <button onClick={redo}>Redo</button>
          <ActionCreator actionTypes={this.state.actionTypes}/>
          <Log history={this.state.history} future={this.state.future} restoreFromHistory={restoreFromHistory} restoreFromFuture={restoreFromFuture} />
        </div>
      </div>
    )
  }
}

export default App;
