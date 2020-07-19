pragma solidity ^0.5.13;


contract TestTarget {

    string public value;

    event Test(string param);

    function update(string calldata _param) external {
      value = _param;
      emit Test(_param);
    }
}
