// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.16;

import "contracts/hub/PWNHub.sol";
import "contracts/hub/PWNHubTags.sol";
import "contracts/PWNErrors.sol";

/**
 * @title PWN Hub Access Control
 * @notice Implement modifiers for PWN Hub access control.
 */
abstract contract PWNHubAccessControl {
    /*----------------------------------------------------------*|
    |*  # VARIABLES & CONSTANTS DEFINITIONS                     *|
    |*----------------------------------------------------------*/

    PWNHub internal immutable hub;

    /*----------------------------------------------------------*|
    |*  # MODIFIERS                                             *|
    |*----------------------------------------------------------*/

    modifier onlyActiveLoan() {
        if (hub.hasTag(msg.sender, PWNHubTags.ACTIVE_LOAN) == false)
            revert CallerMissingHubTag(PWNHubTags.ACTIVE_LOAN);
        _;
    }

    modifier onlyWithTag(bytes32 tag) {
        if (hub.hasTag(msg.sender, tag) == false)
            revert CallerMissingHubTag(tag);
        _;
    }

    /*----------------------------------------------------------*|
    |*  # CONSTRUCTOR                                           *|
    |*----------------------------------------------------------*/

    constructor(address pwnHub) {
        hub = PWNHub(pwnHub);
    }
}
