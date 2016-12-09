import React, { Component, PropTypes } from 'react';

import LogEntry from './LogEntry';



// const searchBar = ({ history, future }) => {

//     //loop thru history and check whether search term exists
//     // const foundinHistory = {};

//     // //loop thru future and check whether search term exists
//     // const foundinFuture = {};

//   render() {
//     return (
//       <form
//         // onSubmit={this.onFormSubmit}
//         className="input">
//         <input
//           className="search_bar"
//           placeholder = "Search in Log"
//           // onChange={ (e) => search(e.target.value) }
//           // value={foundinHistory|| foundinFuture}
//           />
//         <span className="input-btn">
//           <button type="submit" className="btn"> Submit </button>
//         </span>
//        </form>
//     );
//   }
// }


class searchBar extends Component {
  render() {
    return (
    	<form
    		// onSubmit={this.onFormSubmit}
    		className="input">
        <input
          className="search_bar"
          placeholder = "Search in Log"
          // onChange={ (e) => search(e.target.value) }
          // value={ITEM IN HISTORY || ITEM IN FUTURE}
          />
        <span className="input-btn">
        	<button type="submit" className="btn"> Submit </button>
        </span>
       </form>
    );
  }
}

export default searchBar;