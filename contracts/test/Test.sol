pragma solidity ^0.5.13;


contract TestTarget {

    event Test(string param);

    function tryme(string calldata _param) external {
      emit Test(_param);
    }
}
