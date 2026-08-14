/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-mixed-operators, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars, default-case, jsdoc/require-param*/
import $protobuf from "protobufjs/minimal.js";

// Common aliases
const $Reader = $protobuf.Reader, $util = $protobuf.util;
const $Object = $util.global.Object, $undefined = $util.global.undefined, $Error = $util.global.Error;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const UserMedleyEventRankingResponse = $root.UserMedleyEventRankingResponse = (() => {

    /**
     * Properties of a UserMedleyEventRankingResponse.
     * @typedef {Object} UserMedleyEventRankingResponse.$Properties
     * @property {RankingUserList.$Properties|null} [eventPointNearUsers] UserMedleyEventRankingResponse eventPointNearUsers
     * @property {RankingUserList.$Properties|null} [eventPointTopUsers] UserMedleyEventRankingResponse eventPointTopUsers
     * @property {RankingUserList.$Properties|null} [scoreNearUsers] UserMedleyEventRankingResponse scoreNearUsers
     * @property {RankingUserList.$Properties|null} [scoreTopUsers] UserMedleyEventRankingResponse scoreTopUsers
     * @property {RankingUserList.$Properties|null} [eventPointBorderUsers] UserMedleyEventRankingResponse eventPointBorderUsers
     * @property {RankingUserList.$Properties|null} [scoreBorderUsers] UserMedleyEventRankingResponse scoreBorderUsers
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a UserMedleyEventRankingResponse.
     * @exports IUserMedleyEventRankingResponse
     * @interface IUserMedleyEventRankingResponse
     * @augments UserMedleyEventRankingResponse.$Properties
     * @deprecated Use UserMedleyEventRankingResponse.$Properties instead.
     */

    /**
     * Shape of a UserMedleyEventRankingResponse.
     * @typedef {UserMedleyEventRankingResponse.$Properties} UserMedleyEventRankingResponse.$Shape
     */

    /**
     * Constructs a new UserMedleyEventRankingResponse.
     * @exports UserMedleyEventRankingResponse
     * @classdesc Represents a UserMedleyEventRankingResponse.
     * @constructor
     * @param {UserMedleyEventRankingResponse.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const UserMedleyEventRankingResponse = function (p) {
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * UserMedleyEventRankingResponse eventPointNearUsers.
     * @member {RankingUserList.$Properties|null|undefined} eventPointNearUsers
     * @memberof UserMedleyEventRankingResponse
     * @instance
     */
    UserMedleyEventRankingResponse.prototype.eventPointNearUsers = null;

    /**
     * UserMedleyEventRankingResponse eventPointTopUsers.
     * @member {RankingUserList.$Properties|null|undefined} eventPointTopUsers
     * @memberof UserMedleyEventRankingResponse
     * @instance
     */
    UserMedleyEventRankingResponse.prototype.eventPointTopUsers = null;

    /**
     * UserMedleyEventRankingResponse scoreNearUsers.
     * @member {RankingUserList.$Properties|null|undefined} scoreNearUsers
     * @memberof UserMedleyEventRankingResponse
     * @instance
     */
    UserMedleyEventRankingResponse.prototype.scoreNearUsers = null;

    /**
     * UserMedleyEventRankingResponse scoreTopUsers.
     * @member {RankingUserList.$Properties|null|undefined} scoreTopUsers
     * @memberof UserMedleyEventRankingResponse
     * @instance
     */
    UserMedleyEventRankingResponse.prototype.scoreTopUsers = null;

    /**
     * UserMedleyEventRankingResponse eventPointBorderUsers.
     * @member {RankingUserList.$Properties|null|undefined} eventPointBorderUsers
     * @memberof UserMedleyEventRankingResponse
     * @instance
     */
    UserMedleyEventRankingResponse.prototype.eventPointBorderUsers = null;

    /**
     * UserMedleyEventRankingResponse scoreBorderUsers.
     * @member {RankingUserList.$Properties|null|undefined} scoreBorderUsers
     * @memberof UserMedleyEventRankingResponse
     * @instance
     */
    UserMedleyEventRankingResponse.prototype.scoreBorderUsers = null;

    /**
     * Decodes a UserMedleyEventRankingResponse message from the specified reader or buffer.
     * @function decode
     * @memberof UserMedleyEventRankingResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {UserMedleyEventRankingResponse & UserMedleyEventRankingResponse.$Shape} UserMedleyEventRankingResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserMedleyEventRankingResponse.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.UserMedleyEventRankingResponse(), v;
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 2)
                        break;
                    m.eventPointNearUsers = $root.RankingUserList.decode(r, r.uint32(), $undefined, q + 1, m.eventPointNearUsers);
                    continue;
                }
            case 2: {
                    if (u !== 2)
                        break;
                    m.eventPointTopUsers = $root.RankingUserList.decode(r, r.uint32(), $undefined, q + 1, m.eventPointTopUsers);
                    continue;
                }
            case 3: {
                    if (u !== 2)
                        break;
                    m.scoreNearUsers = $root.RankingUserList.decode(r, r.uint32(), $undefined, q + 1, m.scoreNearUsers);
                    continue;
                }
            case 4: {
                    if (u !== 2)
                        break;
                    m.scoreTopUsers = $root.RankingUserList.decode(r, r.uint32(), $undefined, q + 1, m.scoreTopUsers);
                    continue;
                }
            case 5: {
                    if (u !== 2)
                        break;
                    m.eventPointBorderUsers = $root.RankingUserList.decode(r, r.uint32(), $undefined, q + 1, m.eventPointBorderUsers);
                    continue;
                }
            case 6: {
                    if (u !== 2)
                        break;
                    m.scoreBorderUsers = $root.RankingUserList.decode(r, r.uint32(), $undefined, q + 1, m.scoreBorderUsers);
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return UserMedleyEventRankingResponse;
})();

export const RankingUser = $root.RankingUser = (() => {

    /**
     * Properties of a RankingUser.
     * @typedef {Object} RankingUser.$Properties
     * @property {string|null} [name] RankingUser name
     * @property {boolean|null} [ownFlg] RankingUser ownFlg
     * @property {number|null} [rankLevel] RankingUser rankLevel
     * @property {string|null} [introduction] RankingUser introduction
     * @property {number|null} [rank] RankingUser rank
     * @property {number|null} [point] RankingUser point
     * @property {number|null} [userId] RankingUser userId
     * @property {number|null} [degreeId] RankingUser degreeId
     * @property {UserDeck.$Properties|null} [userDeck] RankingUser userDeck
     * @property {UserSituationList.$Properties|null} [userSituationList] RankingUser userSituationList
     * @property {UserProfileSituation.$Properties|null} [userProfileSituation] RankingUser userProfileSituation
     * @property {UserProfileDegreeMap.$Properties|null} [userProfileDegreeMap] RankingUser userProfileDegreeMap
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a RankingUser.
     * @exports IRankingUser
     * @interface IRankingUser
     * @augments RankingUser.$Properties
     * @deprecated Use RankingUser.$Properties instead.
     */

    /**
     * Shape of a RankingUser.
     * @typedef {RankingUser.$Properties} RankingUser.$Shape
     */

    /**
     * Constructs a new RankingUser.
     * @exports RankingUser
     * @classdesc Represents a RankingUser.
     * @constructor
     * @param {RankingUser.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const RankingUser = function (p) {
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * RankingUser name.
     * @member {string} name
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.name = "";

    /**
     * RankingUser ownFlg.
     * @member {boolean} ownFlg
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.ownFlg = false;

    /**
     * RankingUser rankLevel.
     * @member {number} rankLevel
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.rankLevel = 0;

    /**
     * RankingUser introduction.
     * @member {string} introduction
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.introduction = "";

    /**
     * RankingUser rank.
     * @member {number} rank
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.rank = 0;

    /**
     * RankingUser point.
     * @member {number} point
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.point = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * RankingUser userId.
     * @member {number} userId
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.userId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * RankingUser degreeId.
     * @member {number} degreeId
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.degreeId = 0;

    /**
     * RankingUser userDeck.
     * @member {UserDeck.$Properties|null|undefined} userDeck
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.userDeck = null;

    /**
     * RankingUser userSituationList.
     * @member {UserSituationList.$Properties|null|undefined} userSituationList
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.userSituationList = null;

    /**
     * RankingUser userProfileSituation.
     * @member {UserProfileSituation.$Properties|null|undefined} userProfileSituation
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.userProfileSituation = null;

    /**
     * RankingUser userProfileDegreeMap.
     * @member {UserProfileDegreeMap.$Properties|null|undefined} userProfileDegreeMap
     * @memberof RankingUser
     * @instance
     */
    RankingUser.prototype.userProfileDegreeMap = null;

    /**
     * Decodes a RankingUser message from the specified reader or buffer.
     * @function decode
     * @memberof RankingUser
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {RankingUser & RankingUser.$Shape} RankingUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RankingUser.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.RankingUser(), v;
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.name = v;
                    else
                        delete m.name;
                    continue;
                }
            case 2: {
                    if (u !== 0)
                        break;
                    if (v = r.bool())
                        m.ownFlg = v;
                    else
                        delete m.ownFlg;
                    continue;
                }
            case 3: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.rankLevel = v;
                    else
                        delete m.rankLevel;
                    continue;
                }
            case 4: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.introduction = v;
                    else
                        delete m.introduction;
                    continue;
                }
            case 5: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.rank = v;
                    else
                        delete m.rank;
                    continue;
                }
            case 6: {
                    if (u !== 0)
                        break;
                    if (typeof (v = r.uint64()) === "object" ? v.low || v.high : v !== 0)
                        m.point = v;
                    else
                        delete m.point;
                    continue;
                }
            case 7: {
                    if (u !== 0)
                        break;
                    if (typeof (v = r.uint64()) === "object" ? v.low || v.high : v !== 0)
                        m.userId = v;
                    else
                        delete m.userId;
                    continue;
                }
            case 8: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.degreeId = v;
                    else
                        delete m.degreeId;
                    continue;
                }
            case 9: {
                    if (u !== 2)
                        break;
                    m.userDeck = $root.UserDeck.decode(r, r.uint32(), $undefined, q + 1, m.userDeck);
                    continue;
                }
            case 10: {
                    if (u !== 2)
                        break;
                    m.userSituationList = $root.UserSituationList.decode(r, r.uint32(), $undefined, q + 1, m.userSituationList);
                    continue;
                }
            case 11: {
                    if (u !== 2)
                        break;
                    m.userProfileSituation = $root.UserProfileSituation.decode(r, r.uint32(), $undefined, q + 1, m.userProfileSituation);
                    continue;
                }
            case 12: {
                    if (u !== 2)
                        break;
                    m.userProfileDegreeMap = $root.UserProfileDegreeMap.decode(r, r.uint32(), $undefined, q + 1, m.userProfileDegreeMap);
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return RankingUser;
})();

export const RankingUserList = $root.RankingUserList = (() => {

    /**
     * Properties of a RankingUserList.
     * @typedef {Object} RankingUserList.$Properties
     * @property {Array.<RankingUser.$Properties>|null} [entries] RankingUserList entries
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a RankingUserList.
     * @exports IRankingUserList
     * @interface IRankingUserList
     * @augments RankingUserList.$Properties
     * @deprecated Use RankingUserList.$Properties instead.
     */

    /**
     * Shape of a RankingUserList.
     * @typedef {RankingUserList.$Properties} RankingUserList.$Shape
     */

    /**
     * Constructs a new RankingUserList.
     * @exports RankingUserList
     * @classdesc Represents a RankingUserList.
     * @constructor
     * @param {RankingUserList.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const RankingUserList = function (p) {
        this.entries = [];
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * RankingUserList entries.
     * @member {Array.<RankingUser.$Properties>} entries
     * @memberof RankingUserList
     * @instance
     */
    RankingUserList.prototype.entries = $util.emptyArray;

    /**
     * Decodes a RankingUserList message from the specified reader or buffer.
     * @function decode
     * @memberof RankingUserList
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {RankingUserList & RankingUserList.$Shape} RankingUserList
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RankingUserList.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.RankingUserList();
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 2)
                        break;
                    if (!(m.entries && m.entries.length))
                        m.entries = [];
                    m.entries.push($root.RankingUser.decode(r, r.uint32(), $undefined, q + 1));
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return RankingUserList;
})();

export const UserAppendParameter = $root.UserAppendParameter = (() => {

    /**
     * Properties of a UserAppendParameter.
     * @typedef {Object} UserAppendParameter.$Properties
     * @property {number|null} [userId] UserAppendParameter userId
     * @property {number|null} [situationId] UserAppendParameter situationId
     * @property {number|null} [performance] UserAppendParameter performance
     * @property {number|null} [technique] UserAppendParameter technique
     * @property {number|null} [visual] UserAppendParameter visual
     * @property {number|null} [characterPotentialPerformance] UserAppendParameter characterPotentialPerformance
     * @property {number|null} [characterPotentialTechnique] UserAppendParameter characterPotentialTechnique
     * @property {number|null} [characterPotentialVisual] UserAppendParameter characterPotentialVisual
     * @property {number|null} [characterBonusPerformance] UserAppendParameter characterBonusPerformance
     * @property {number|null} [characterBonusTechnique] UserAppendParameter characterBonusTechnique
     * @property {number|null} [characterBonusVisual] UserAppendParameter characterBonusVisual
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a UserAppendParameter.
     * @exports IUserAppendParameter
     * @interface IUserAppendParameter
     * @augments UserAppendParameter.$Properties
     * @deprecated Use UserAppendParameter.$Properties instead.
     */

    /**
     * Shape of a UserAppendParameter.
     * @typedef {UserAppendParameter.$Properties} UserAppendParameter.$Shape
     */

    /**
     * Constructs a new UserAppendParameter.
     * @exports UserAppendParameter
     * @classdesc Represents a UserAppendParameter.
     * @constructor
     * @param {UserAppendParameter.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const UserAppendParameter = function (p) {
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * UserAppendParameter userId.
     * @member {number} userId
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.userId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * UserAppendParameter situationId.
     * @member {number} situationId
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.situationId = 0;

    /**
     * UserAppendParameter performance.
     * @member {number} performance
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.performance = 0;

    /**
     * UserAppendParameter technique.
     * @member {number} technique
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.technique = 0;

    /**
     * UserAppendParameter visual.
     * @member {number} visual
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.visual = 0;

    /**
     * UserAppendParameter characterPotentialPerformance.
     * @member {number} characterPotentialPerformance
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.characterPotentialPerformance = 0;

    /**
     * UserAppendParameter characterPotentialTechnique.
     * @member {number} characterPotentialTechnique
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.characterPotentialTechnique = 0;

    /**
     * UserAppendParameter characterPotentialVisual.
     * @member {number} characterPotentialVisual
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.characterPotentialVisual = 0;

    /**
     * UserAppendParameter characterBonusPerformance.
     * @member {number} characterBonusPerformance
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.characterBonusPerformance = 0;

    /**
     * UserAppendParameter characterBonusTechnique.
     * @member {number} characterBonusTechnique
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.characterBonusTechnique = 0;

    /**
     * UserAppendParameter characterBonusVisual.
     * @member {number} characterBonusVisual
     * @memberof UserAppendParameter
     * @instance
     */
    UserAppendParameter.prototype.characterBonusVisual = 0;

    /**
     * Decodes a UserAppendParameter message from the specified reader or buffer.
     * @function decode
     * @memberof UserAppendParameter
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {UserAppendParameter & UserAppendParameter.$Shape} UserAppendParameter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserAppendParameter.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.UserAppendParameter(), v;
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 0)
                        break;
                    if (typeof (v = r.uint64()) === "object" ? v.low || v.high : v !== 0)
                        m.userId = v;
                    else
                        delete m.userId;
                    continue;
                }
            case 2: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.situationId = v;
                    else
                        delete m.situationId;
                    continue;
                }
            case 3: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.performance = v;
                    else
                        delete m.performance;
                    continue;
                }
            case 4: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.technique = v;
                    else
                        delete m.technique;
                    continue;
                }
            case 5: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.visual = v;
                    else
                        delete m.visual;
                    continue;
                }
            case 6: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.characterPotentialPerformance = v;
                    else
                        delete m.characterPotentialPerformance;
                    continue;
                }
            case 7: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.characterPotentialTechnique = v;
                    else
                        delete m.characterPotentialTechnique;
                    continue;
                }
            case 8: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.characterPotentialVisual = v;
                    else
                        delete m.characterPotentialVisual;
                    continue;
                }
            case 9: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.characterBonusPerformance = v;
                    else
                        delete m.characterBonusPerformance;
                    continue;
                }
            case 10: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.characterBonusTechnique = v;
                    else
                        delete m.characterBonusTechnique;
                    continue;
                }
            case 11: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.characterBonusVisual = v;
                    else
                        delete m.characterBonusVisual;
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return UserAppendParameter;
})();

export const UserDeck = $root.UserDeck = (() => {

    /**
     * Properties of a UserDeck.
     * @typedef {Object} UserDeck.$Properties
     * @property {number|null} [deckId] UserDeck deckId
     * @property {string|null} [deckName] UserDeck deckName
     * @property {number|null} [leader] UserDeck leader
     * @property {number|null} [member1] UserDeck member1
     * @property {number|null} [member2] UserDeck member2
     * @property {number|null} [member3] UserDeck member3
     * @property {number|null} [member4] UserDeck member4
     * @property {Array.<number>|null} [bondsEffectIds] UserDeck bondsEffectIds
     * @property {string|null} [deckType] UserDeck deckType
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a UserDeck.
     * @exports IUserDeck
     * @interface IUserDeck
     * @augments UserDeck.$Properties
     * @deprecated Use UserDeck.$Properties instead.
     */

    /**
     * Shape of a UserDeck.
     * @typedef {UserDeck.$Properties} UserDeck.$Shape
     */

    /**
     * Constructs a new UserDeck.
     * @exports UserDeck
     * @classdesc Represents a UserDeck.
     * @constructor
     * @param {UserDeck.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const UserDeck = function (p) {
        this.bondsEffectIds = [];
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * UserDeck deckId.
     * @member {number} deckId
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.deckId = 0;

    /**
     * UserDeck deckName.
     * @member {string} deckName
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.deckName = "";

    /**
     * UserDeck leader.
     * @member {number} leader
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.leader = 0;

    /**
     * UserDeck member1.
     * @member {number} member1
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.member1 = 0;

    /**
     * UserDeck member2.
     * @member {number} member2
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.member2 = 0;

    /**
     * UserDeck member3.
     * @member {number} member3
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.member3 = 0;

    /**
     * UserDeck member4.
     * @member {number} member4
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.member4 = 0;

    /**
     * UserDeck bondsEffectIds.
     * @member {Array.<number>} bondsEffectIds
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.bondsEffectIds = $util.emptyArray;

    /**
     * UserDeck deckType.
     * @member {string} deckType
     * @memberof UserDeck
     * @instance
     */
    UserDeck.prototype.deckType = "";

    /**
     * Decodes a UserDeck message from the specified reader or buffer.
     * @function decode
     * @memberof UserDeck
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {UserDeck & UserDeck.$Shape} UserDeck
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserDeck.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.UserDeck(), v;
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.deckId = v;
                    else
                        delete m.deckId;
                    continue;
                }
            case 2: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.deckName = v;
                    else
                        delete m.deckName;
                    continue;
                }
            case 3: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.leader = v;
                    else
                        delete m.leader;
                    continue;
                }
            case 4: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.member1 = v;
                    else
                        delete m.member1;
                    continue;
                }
            case 5: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.member2 = v;
                    else
                        delete m.member2;
                    continue;
                }
            case 6: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.member3 = v;
                    else
                        delete m.member3;
                    continue;
                }
            case 7: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.member4 = v;
                    else
                        delete m.member4;
                    continue;
                }
            case 8: {
                    if (u === 2) {
                        if (!(m.bondsEffectIds && m.bondsEffectIds.length))
                            m.bondsEffectIds = [];
                        r.uint32s(m.bondsEffectIds);
                        continue;
                    }
                    if (u !== 0)
                        break;
                    if (!(m.bondsEffectIds && m.bondsEffectIds.length))
                        m.bondsEffectIds = [];
                    m.bondsEffectIds.push(r.uint32());
                    continue;
                }
            case 10: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.deckType = v;
                    else
                        delete m.deckType;
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return UserDeck;
})();

export const UserProfileDegree = $root.UserProfileDegree = (() => {

    /**
     * Properties of a UserProfileDegree.
     * @typedef {Object} UserProfileDegree.$Properties
     * @property {number|null} [userId] UserProfileDegree userId
     * @property {string|null} [profileDegreeType] UserProfileDegree profileDegreeType
     * @property {number|null} [degreeId] UserProfileDegree degreeId
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a UserProfileDegree.
     * @exports IUserProfileDegree
     * @interface IUserProfileDegree
     * @augments UserProfileDegree.$Properties
     * @deprecated Use UserProfileDegree.$Properties instead.
     */

    /**
     * Shape of a UserProfileDegree.
     * @typedef {UserProfileDegree.$Properties} UserProfileDegree.$Shape
     */

    /**
     * Constructs a new UserProfileDegree.
     * @exports UserProfileDegree
     * @classdesc Represents a UserProfileDegree.
     * @constructor
     * @param {UserProfileDegree.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const UserProfileDegree = function (p) {
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * UserProfileDegree userId.
     * @member {number} userId
     * @memberof UserProfileDegree
     * @instance
     */
    UserProfileDegree.prototype.userId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * UserProfileDegree profileDegreeType.
     * @member {string} profileDegreeType
     * @memberof UserProfileDegree
     * @instance
     */
    UserProfileDegree.prototype.profileDegreeType = "";

    /**
     * UserProfileDegree degreeId.
     * @member {number} degreeId
     * @memberof UserProfileDegree
     * @instance
     */
    UserProfileDegree.prototype.degreeId = 0;

    /**
     * Decodes a UserProfileDegree message from the specified reader or buffer.
     * @function decode
     * @memberof UserProfileDegree
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {UserProfileDegree & UserProfileDegree.$Shape} UserProfileDegree
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserProfileDegree.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.UserProfileDegree(), v;
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 0)
                        break;
                    if (typeof (v = r.uint64()) === "object" ? v.low || v.high : v !== 0)
                        m.userId = v;
                    else
                        delete m.userId;
                    continue;
                }
            case 2: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.profileDegreeType = v;
                    else
                        delete m.profileDegreeType;
                    continue;
                }
            case 3: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.degreeId = v;
                    else
                        delete m.degreeId;
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return UserProfileDegree;
})();

export const UserProfileDegreeMap = $root.UserProfileDegreeMap = (() => {

    /**
     * Properties of a UserProfileDegreeMap.
     * @typedef {Object} UserProfileDegreeMap.$Properties
     * @property {Object.<string,UserProfileDegree.$Properties>|null} [entries] UserProfileDegreeMap entries
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a UserProfileDegreeMap.
     * @exports IUserProfileDegreeMap
     * @interface IUserProfileDegreeMap
     * @augments UserProfileDegreeMap.$Properties
     * @deprecated Use UserProfileDegreeMap.$Properties instead.
     */

    /**
     * Shape of a UserProfileDegreeMap.
     * @typedef {UserProfileDegreeMap.$Properties} UserProfileDegreeMap.$Shape
     */

    /**
     * Constructs a new UserProfileDegreeMap.
     * @exports UserProfileDegreeMap
     * @classdesc Represents a UserProfileDegreeMap.
     * @constructor
     * @param {UserProfileDegreeMap.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const UserProfileDegreeMap = function (p) {
        this.entries = {};
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * UserProfileDegreeMap entries.
     * @member {Object.<string,UserProfileDegree.$Properties>} entries
     * @memberof UserProfileDegreeMap
     * @instance
     */
    UserProfileDegreeMap.prototype.entries = $util.emptyObject;

    /**
     * Decodes a UserProfileDegreeMap message from the specified reader or buffer.
     * @function decode
     * @memberof UserProfileDegreeMap
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {UserProfileDegreeMap & UserProfileDegreeMap.$Shape} UserProfileDegreeMap
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserProfileDegreeMap.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.UserProfileDegreeMap(), k, v;
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 2)
                        break;
                    if (m.entries === $util.emptyObject)
                        m.entries = {};
                    var c2 = r.uint32() + r.pos;
                    k = "";
                    v = null;
                    while (r.pos < c2) {
                        var t2 = r.tag();
                        u = t2 & 7;
                        switch (t2 >>>= 3) {
                        case 1:
                            if (u !== 2)
                                break;
                            k = r.stringVerify();
                            continue;
                        case 2:
                            if (u !== 2)
                                break;
                            v = $root.UserProfileDegree.decode(r, r.uint32(), $undefined, q + 1, v);
                            continue;
                        }
                        r.skipType(u, q, t2);
                    }
                    if (k === "__proto__")
                        $util.makeProp(m.entries, k);
                    m.entries[k] = v || new $root.UserProfileDegree();
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return UserProfileDegreeMap;
})();

export const UserProfileSituation = $root.UserProfileSituation = (() => {

    /**
     * Properties of a UserProfileSituation.
     * @typedef {Object} UserProfileSituation.$Properties
     * @property {number|null} [userId] UserProfileSituation userId
     * @property {number|null} [situationId] UserProfileSituation situationId
     * @property {string|null} [illust] UserProfileSituation illust
     * @property {string|null} [viewProfileSituationStatus] UserProfileSituation viewProfileSituationStatus
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a UserProfileSituation.
     * @exports IUserProfileSituation
     * @interface IUserProfileSituation
     * @augments UserProfileSituation.$Properties
     * @deprecated Use UserProfileSituation.$Properties instead.
     */

    /**
     * Shape of a UserProfileSituation.
     * @typedef {UserProfileSituation.$Properties} UserProfileSituation.$Shape
     */

    /**
     * Constructs a new UserProfileSituation.
     * @exports UserProfileSituation
     * @classdesc Represents a UserProfileSituation.
     * @constructor
     * @param {UserProfileSituation.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const UserProfileSituation = function (p) {
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * UserProfileSituation userId.
     * @member {number} userId
     * @memberof UserProfileSituation
     * @instance
     */
    UserProfileSituation.prototype.userId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * UserProfileSituation situationId.
     * @member {number} situationId
     * @memberof UserProfileSituation
     * @instance
     */
    UserProfileSituation.prototype.situationId = 0;

    /**
     * UserProfileSituation illust.
     * @member {string} illust
     * @memberof UserProfileSituation
     * @instance
     */
    UserProfileSituation.prototype.illust = "";

    /**
     * UserProfileSituation viewProfileSituationStatus.
     * @member {string} viewProfileSituationStatus
     * @memberof UserProfileSituation
     * @instance
     */
    UserProfileSituation.prototype.viewProfileSituationStatus = "";

    /**
     * Decodes a UserProfileSituation message from the specified reader or buffer.
     * @function decode
     * @memberof UserProfileSituation
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {UserProfileSituation & UserProfileSituation.$Shape} UserProfileSituation
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserProfileSituation.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.UserProfileSituation(), v;
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 0)
                        break;
                    if (typeof (v = r.uint64()) === "object" ? v.low || v.high : v !== 0)
                        m.userId = v;
                    else
                        delete m.userId;
                    continue;
                }
            case 2: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.situationId = v;
                    else
                        delete m.situationId;
                    continue;
                }
            case 3: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.illust = v;
                    else
                        delete m.illust;
                    continue;
                }
            case 4: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.viewProfileSituationStatus = v;
                    else
                        delete m.viewProfileSituationStatus;
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return UserProfileSituation;
})();

export const UserSituation = $root.UserSituation = (() => {

    /**
     * Properties of a UserSituation.
     * @typedef {Object} UserSituation.$Properties
     * @property {number|null} [userId] UserSituation userId
     * @property {number|null} [situationId] UserSituation situationId
     * @property {number|null} [level] UserSituation level
     * @property {number|null} [exp] UserSituation exp
     * @property {number|null} [createdAt] UserSituation createdAt
     * @property {number|null} [addExp] UserSituation addExp
     * @property {string|null} [trainingStatus] UserSituation trainingStatus
     * @property {number|null} [duplicateCount] UserSituation duplicateCount
     * @property {string|null} [illust] UserSituation illust
     * @property {number|null} [skillExp] UserSituation skillExp
     * @property {number|null} [skillLevel] UserSituation skillLevel
     * @property {UserAppendParameter.$Properties|null} [userAppendParameter] UserSituation userAppendParameter
     * @property {number|null} [limitBreakRank] UserSituation limitBreakRank
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a UserSituation.
     * @exports IUserSituation
     * @interface IUserSituation
     * @augments UserSituation.$Properties
     * @deprecated Use UserSituation.$Properties instead.
     */

    /**
     * Shape of a UserSituation.
     * @typedef {UserSituation.$Properties} UserSituation.$Shape
     */

    /**
     * Constructs a new UserSituation.
     * @exports UserSituation
     * @classdesc Represents a UserSituation.
     * @constructor
     * @param {UserSituation.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const UserSituation = function (p) {
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * UserSituation userId.
     * @member {number} userId
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.userId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * UserSituation situationId.
     * @member {number} situationId
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.situationId = 0;

    /**
     * UserSituation level.
     * @member {number} level
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.level = 0;

    /**
     * UserSituation exp.
     * @member {number} exp
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.exp = 0;

    /**
     * UserSituation createdAt.
     * @member {number} createdAt
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.createdAt = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * UserSituation addExp.
     * @member {number} addExp
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.addExp = 0;

    /**
     * UserSituation trainingStatus.
     * @member {string} trainingStatus
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.trainingStatus = "";

    /**
     * UserSituation duplicateCount.
     * @member {number} duplicateCount
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.duplicateCount = 0;

    /**
     * UserSituation illust.
     * @member {string} illust
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.illust = "";

    /**
     * UserSituation skillExp.
     * @member {number} skillExp
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.skillExp = 0;

    /**
     * UserSituation skillLevel.
     * @member {number} skillLevel
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.skillLevel = 0;

    /**
     * UserSituation userAppendParameter.
     * @member {UserAppendParameter.$Properties|null|undefined} userAppendParameter
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.userAppendParameter = null;

    /**
     * UserSituation limitBreakRank.
     * @member {number} limitBreakRank
     * @memberof UserSituation
     * @instance
     */
    UserSituation.prototype.limitBreakRank = 0;

    /**
     * Decodes a UserSituation message from the specified reader or buffer.
     * @function decode
     * @memberof UserSituation
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {UserSituation & UserSituation.$Shape} UserSituation
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserSituation.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.UserSituation(), v;
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 0)
                        break;
                    if (typeof (v = r.uint64()) === "object" ? v.low || v.high : v !== 0)
                        m.userId = v;
                    else
                        delete m.userId;
                    continue;
                }
            case 2: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.situationId = v;
                    else
                        delete m.situationId;
                    continue;
                }
            case 3: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.level = v;
                    else
                        delete m.level;
                    continue;
                }
            case 4: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.exp = v;
                    else
                        delete m.exp;
                    continue;
                }
            case 5: {
                    if (u !== 0)
                        break;
                    if (typeof (v = r.uint64()) === "object" ? v.low || v.high : v !== 0)
                        m.createdAt = v;
                    else
                        delete m.createdAt;
                    continue;
                }
            case 6: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.addExp = v;
                    else
                        delete m.addExp;
                    continue;
                }
            case 7: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.trainingStatus = v;
                    else
                        delete m.trainingStatus;
                    continue;
                }
            case 8: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.duplicateCount = v;
                    else
                        delete m.duplicateCount;
                    continue;
                }
            case 9: {
                    if (u !== 2)
                        break;
                    if ((v = r.stringVerify()).length)
                        m.illust = v;
                    else
                        delete m.illust;
                    continue;
                }
            case 10: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.skillExp = v;
                    else
                        delete m.skillExp;
                    continue;
                }
            case 11: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.skillLevel = v;
                    else
                        delete m.skillLevel;
                    continue;
                }
            case 12: {
                    if (u !== 2)
                        break;
                    m.userAppendParameter = $root.UserAppendParameter.decode(r, r.uint32(), $undefined, q + 1, m.userAppendParameter);
                    continue;
                }
            case 13: {
                    if (u !== 0)
                        break;
                    if (v = r.uint32())
                        m.limitBreakRank = v;
                    else
                        delete m.limitBreakRank;
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return UserSituation;
})();

export const UserSituationList = $root.UserSituationList = (() => {

    /**
     * Properties of a UserSituationList.
     * @typedef {Object} UserSituationList.$Properties
     * @property {Array.<UserSituation.$Properties>|null} [entries] UserSituationList entries
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a UserSituationList.
     * @exports IUserSituationList
     * @interface IUserSituationList
     * @augments UserSituationList.$Properties
     * @deprecated Use UserSituationList.$Properties instead.
     */

    /**
     * Shape of a UserSituationList.
     * @typedef {UserSituationList.$Properties} UserSituationList.$Shape
     */

    /**
     * Constructs a new UserSituationList.
     * @exports UserSituationList
     * @classdesc Represents a UserSituationList.
     * @constructor
     * @param {UserSituationList.$Properties=} [p] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    const UserSituationList = function (p) {
        this.entries = [];
        if (p)
            for (var ks = $Object.keys(p), i = 0; i < ks.length; ++i)
                if (p[ks[i]] != null && ks[i] !== "__proto__")
                    this[ks[i]] = p[ks[i]];
    };

    /**
     * UserSituationList entries.
     * @member {Array.<UserSituation.$Properties>} entries
     * @memberof UserSituationList
     * @instance
     */
    UserSituationList.prototype.entries = $util.emptyArray;

    /**
     * Decodes a UserSituationList message from the specified reader or buffer.
     * @function decode
     * @memberof UserSituationList
     * @static
     * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
     * @param {number} [l] Message length if known beforehand
     * @returns {UserSituationList & UserSituationList.$Shape} UserSituationList
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserSituationList.decode = function (r, l, z, q, g) {
        if (!(r instanceof $Reader))
            r = $Reader.create(r);
        if (q === $undefined)
            q = 0;
        if (q > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var c = l === $undefined ? r.len : r.pos + l, m = g || new $root.UserSituationList();
        while (r.pos < c) {
            var s = r.pos;
            var t = r.tag();
            if (t === z) {
                z = $undefined;
                break;
            }
            var u = t & 7;
            switch (t >>>= 3) {
            case 1: {
                    if (u !== 2)
                        break;
                    if (!(m.entries && m.entries.length))
                        m.entries = [];
                    m.entries.push($root.UserSituation.decode(r, r.uint32(), $undefined, q + 1));
                    continue;
                }
            }
            r.skipType(u, q, t);
            if (!r.discardUnknown) {
                $util.makeProp(m, "$unknowns", false);
                (m.$unknowns || (m.$unknowns = [])).push(r.raw(s, r.pos));
            }
        }
        if (z !== $undefined)
            throw $Error("missing end group");
        return m;
    };

    return UserSituationList;
})();

export {
  $root as default
};
