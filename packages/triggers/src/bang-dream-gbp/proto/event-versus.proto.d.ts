import * as $protobuf from "protobufjs/minimal.js";
import Long = require("long");

/**
 * Properties of a UserVersusEventRankingResponse.
 * @deprecated Use UserVersusEventRankingResponse.$Properties instead.
 */
export interface IUserVersusEventRankingResponse extends UserVersusEventRankingResponse.$Properties {
}

/** Represents a UserVersusEventRankingResponse. */
export class UserVersusEventRankingResponse {

    /**
     * Constructs a new UserVersusEventRankingResponse.
     * @param [p] Properties to set
     */
    constructor(p?: UserVersusEventRankingResponse.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserVersusEventRankingResponse eventPointNearUsers. */
    eventPointNearUsers?: (RankingUserList.$Properties|null);

    /** UserVersusEventRankingResponse eventPointTopUsers. */
    eventPointTopUsers?: (RankingUserList.$Properties|null);

    /** UserVersusEventRankingResponse versusMusicRankings. */
    versusMusicRankings: UserVersusMusicRankingResponse.$Properties[];

    /** UserVersusEventRankingResponse eventPointBorderUsers. */
    eventPointBorderUsers?: (RankingUserList.$Properties|null);

    /**
     * Decodes a UserVersusEventRankingResponse message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserVersusEventRankingResponse & UserVersusEventRankingResponse.$Shape} UserVersusEventRankingResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserVersusEventRankingResponse & UserVersusEventRankingResponse.$Shape;
}

export namespace UserVersusEventRankingResponse {

    /** Properties of a UserVersusEventRankingResponse. */
    interface $Properties {

        /** UserVersusEventRankingResponse eventPointNearUsers */
        eventPointNearUsers?: (RankingUserList.$Properties|null);

        /** UserVersusEventRankingResponse eventPointTopUsers */
        eventPointTopUsers?: (RankingUserList.$Properties|null);

        /** UserVersusEventRankingResponse versusMusicRankings */
        versusMusicRankings?: (UserVersusMusicRankingResponse.$Properties[]|null);

        /** UserVersusEventRankingResponse eventPointBorderUsers */
        eventPointBorderUsers?: (RankingUserList.$Properties|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserVersusEventRankingResponse. */
    type $Shape = UserVersusEventRankingResponse.$Properties;
}

/**
 * Properties of a RankingUser.
 * @deprecated Use RankingUser.$Properties instead.
 */
export interface IRankingUser extends RankingUser.$Properties {
}

/** Represents a RankingUser. */
export class RankingUser {

    /**
     * Constructs a new RankingUser.
     * @param [p] Properties to set
     */
    constructor(p?: RankingUser.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** RankingUser name. */
    name: string;

    /** RankingUser ownFlg. */
    ownFlg: boolean;

    /** RankingUser rankLevel. */
    rankLevel: number;

    /** RankingUser introduction. */
    introduction: string;

    /** RankingUser rank. */
    rank: number;

    /** RankingUser point. */
    point: number;

    /** RankingUser userId. */
    userId: number;

    /** RankingUser degreeId. */
    degreeId: number;

    /** RankingUser userDeck. */
    userDeck?: (UserDeck.$Properties|null);

    /** RankingUser userSituationList. */
    userSituationList?: (UserSituationList.$Properties|null);

    /** RankingUser userProfileSituation. */
    userProfileSituation?: (UserProfileSituation.$Properties|null);

    /** RankingUser userProfileDegreeMap. */
    userProfileDegreeMap?: (UserProfileDegreeMap.$Properties|null);

    /**
     * Decodes a RankingUser message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {RankingUser & RankingUser.$Shape} RankingUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): RankingUser & RankingUser.$Shape;
}

export namespace RankingUser {

    /** Properties of a RankingUser. */
    interface $Properties {

        /** RankingUser name */
        name?: (string|null);

        /** RankingUser ownFlg */
        ownFlg?: (boolean|null);

        /** RankingUser rankLevel */
        rankLevel?: (number|null);

        /** RankingUser introduction */
        introduction?: (string|null);

        /** RankingUser rank */
        rank?: (number|null);

        /** RankingUser point */
        point?: (number|null);

        /** RankingUser userId */
        userId?: (number|null);

        /** RankingUser degreeId */
        degreeId?: (number|null);

        /** RankingUser userDeck */
        userDeck?: (UserDeck.$Properties|null);

        /** RankingUser userSituationList */
        userSituationList?: (UserSituationList.$Properties|null);

        /** RankingUser userProfileSituation */
        userProfileSituation?: (UserProfileSituation.$Properties|null);

        /** RankingUser userProfileDegreeMap */
        userProfileDegreeMap?: (UserProfileDegreeMap.$Properties|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a RankingUser. */
    type $Shape = RankingUser.$Properties;
}

/**
 * Properties of a RankingUserList.
 * @deprecated Use RankingUserList.$Properties instead.
 */
export interface IRankingUserList extends RankingUserList.$Properties {
}

/** Represents a RankingUserList. */
export class RankingUserList {

    /**
     * Constructs a new RankingUserList.
     * @param [p] Properties to set
     */
    constructor(p?: RankingUserList.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** RankingUserList entries. */
    entries: RankingUser.$Properties[];

    /**
     * Decodes a RankingUserList message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {RankingUserList & RankingUserList.$Shape} RankingUserList
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): RankingUserList & RankingUserList.$Shape;
}

export namespace RankingUserList {

    /** Properties of a RankingUserList. */
    interface $Properties {

        /** RankingUserList entries */
        entries?: (RankingUser.$Properties[]|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a RankingUserList. */
    type $Shape = RankingUserList.$Properties;
}

/**
 * Properties of a UserAppendParameter.
 * @deprecated Use UserAppendParameter.$Properties instead.
 */
export interface IUserAppendParameter extends UserAppendParameter.$Properties {
}

/** Represents a UserAppendParameter. */
export class UserAppendParameter {

    /**
     * Constructs a new UserAppendParameter.
     * @param [p] Properties to set
     */
    constructor(p?: UserAppendParameter.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserAppendParameter userId. */
    userId: number;

    /** UserAppendParameter situationId. */
    situationId: number;

    /** UserAppendParameter performance. */
    performance: number;

    /** UserAppendParameter technique. */
    technique: number;

    /** UserAppendParameter visual. */
    visual: number;

    /** UserAppendParameter characterPotentialPerformance. */
    characterPotentialPerformance: number;

    /** UserAppendParameter characterPotentialTechnique. */
    characterPotentialTechnique: number;

    /** UserAppendParameter characterPotentialVisual. */
    characterPotentialVisual: number;

    /** UserAppendParameter characterBonusPerformance. */
    characterBonusPerformance: number;

    /** UserAppendParameter characterBonusTechnique. */
    characterBonusTechnique: number;

    /** UserAppendParameter characterBonusVisual. */
    characterBonusVisual: number;

    /**
     * Decodes a UserAppendParameter message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserAppendParameter & UserAppendParameter.$Shape} UserAppendParameter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserAppendParameter & UserAppendParameter.$Shape;
}

export namespace UserAppendParameter {

    /** Properties of a UserAppendParameter. */
    interface $Properties {

        /** UserAppendParameter userId */
        userId?: (number|null);

        /** UserAppendParameter situationId */
        situationId?: (number|null);

        /** UserAppendParameter performance */
        performance?: (number|null);

        /** UserAppendParameter technique */
        technique?: (number|null);

        /** UserAppendParameter visual */
        visual?: (number|null);

        /** UserAppendParameter characterPotentialPerformance */
        characterPotentialPerformance?: (number|null);

        /** UserAppendParameter characterPotentialTechnique */
        characterPotentialTechnique?: (number|null);

        /** UserAppendParameter characterPotentialVisual */
        characterPotentialVisual?: (number|null);

        /** UserAppendParameter characterBonusPerformance */
        characterBonusPerformance?: (number|null);

        /** UserAppendParameter characterBonusTechnique */
        characterBonusTechnique?: (number|null);

        /** UserAppendParameter characterBonusVisual */
        characterBonusVisual?: (number|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserAppendParameter. */
    type $Shape = UserAppendParameter.$Properties;
}

/**
 * Properties of a UserDeck.
 * @deprecated Use UserDeck.$Properties instead.
 */
export interface IUserDeck extends UserDeck.$Properties {
}

/** Represents a UserDeck. */
export class UserDeck {

    /**
     * Constructs a new UserDeck.
     * @param [p] Properties to set
     */
    constructor(p?: UserDeck.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserDeck deckId. */
    deckId: number;

    /** UserDeck deckName. */
    deckName: string;

    /** UserDeck leader. */
    leader: number;

    /** UserDeck member1. */
    member1: number;

    /** UserDeck member2. */
    member2: number;

    /** UserDeck member3. */
    member3: number;

    /** UserDeck member4. */
    member4: number;

    /** UserDeck bondsEffectIds. */
    bondsEffectIds: number[];

    /** UserDeck deckType. */
    deckType: string;

    /**
     * Decodes a UserDeck message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserDeck & UserDeck.$Shape} UserDeck
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserDeck & UserDeck.$Shape;
}

export namespace UserDeck {

    /** Properties of a UserDeck. */
    interface $Properties {

        /** UserDeck deckId */
        deckId?: (number|null);

        /** UserDeck deckName */
        deckName?: (string|null);

        /** UserDeck leader */
        leader?: (number|null);

        /** UserDeck member1 */
        member1?: (number|null);

        /** UserDeck member2 */
        member2?: (number|null);

        /** UserDeck member3 */
        member3?: (number|null);

        /** UserDeck member4 */
        member4?: (number|null);

        /** UserDeck bondsEffectIds */
        bondsEffectIds?: (number[]|null);

        /** UserDeck deckType */
        deckType?: (string|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserDeck. */
    type $Shape = UserDeck.$Properties;
}

/**
 * Properties of a UserProfileDegree.
 * @deprecated Use UserProfileDegree.$Properties instead.
 */
export interface IUserProfileDegree extends UserProfileDegree.$Properties {
}

/** Represents a UserProfileDegree. */
export class UserProfileDegree {

    /**
     * Constructs a new UserProfileDegree.
     * @param [p] Properties to set
     */
    constructor(p?: UserProfileDegree.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserProfileDegree userId. */
    userId: number;

    /** UserProfileDegree profileDegreeType. */
    profileDegreeType: string;

    /** UserProfileDegree degreeId. */
    degreeId: number;

    /**
     * Decodes a UserProfileDegree message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserProfileDegree & UserProfileDegree.$Shape} UserProfileDegree
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserProfileDegree & UserProfileDegree.$Shape;
}

export namespace UserProfileDegree {

    /** Properties of a UserProfileDegree. */
    interface $Properties {

        /** UserProfileDegree userId */
        userId?: (number|null);

        /** UserProfileDegree profileDegreeType */
        profileDegreeType?: (string|null);

        /** UserProfileDegree degreeId */
        degreeId?: (number|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserProfileDegree. */
    type $Shape = UserProfileDegree.$Properties;
}

/**
 * Properties of a UserProfileDegreeMap.
 * @deprecated Use UserProfileDegreeMap.$Properties instead.
 */
export interface IUserProfileDegreeMap extends UserProfileDegreeMap.$Properties {
}

/** Represents a UserProfileDegreeMap. */
export class UserProfileDegreeMap {

    /**
     * Constructs a new UserProfileDegreeMap.
     * @param [p] Properties to set
     */
    constructor(p?: UserProfileDegreeMap.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserProfileDegreeMap entries. */
    entries: { [k: string]: UserProfileDegree.$Properties };

    /**
     * Decodes a UserProfileDegreeMap message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserProfileDegreeMap & UserProfileDegreeMap.$Shape} UserProfileDegreeMap
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserProfileDegreeMap & UserProfileDegreeMap.$Shape;
}

export namespace UserProfileDegreeMap {

    /** Properties of a UserProfileDegreeMap. */
    interface $Properties {

        /** UserProfileDegreeMap entries */
        entries?: ({ [k: string]: UserProfileDegree.$Properties }|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserProfileDegreeMap. */
    type $Shape = UserProfileDegreeMap.$Properties;
}

/**
 * Properties of a UserProfileSituation.
 * @deprecated Use UserProfileSituation.$Properties instead.
 */
export interface IUserProfileSituation extends UserProfileSituation.$Properties {
}

/** Represents a UserProfileSituation. */
export class UserProfileSituation {

    /**
     * Constructs a new UserProfileSituation.
     * @param [p] Properties to set
     */
    constructor(p?: UserProfileSituation.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserProfileSituation userId. */
    userId: number;

    /** UserProfileSituation situationId. */
    situationId: number;

    /** UserProfileSituation illust. */
    illust: string;

    /** UserProfileSituation viewProfileSituationStatus. */
    viewProfileSituationStatus: string;

    /**
     * Decodes a UserProfileSituation message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserProfileSituation & UserProfileSituation.$Shape} UserProfileSituation
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserProfileSituation & UserProfileSituation.$Shape;
}

export namespace UserProfileSituation {

    /** Properties of a UserProfileSituation. */
    interface $Properties {

        /** UserProfileSituation userId */
        userId?: (number|null);

        /** UserProfileSituation situationId */
        situationId?: (number|null);

        /** UserProfileSituation illust */
        illust?: (string|null);

        /** UserProfileSituation viewProfileSituationStatus */
        viewProfileSituationStatus?: (string|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserProfileSituation. */
    type $Shape = UserProfileSituation.$Properties;
}

/**
 * Properties of a UserSituation.
 * @deprecated Use UserSituation.$Properties instead.
 */
export interface IUserSituation extends UserSituation.$Properties {
}

/** Represents a UserSituation. */
export class UserSituation {

    /**
     * Constructs a new UserSituation.
     * @param [p] Properties to set
     */
    constructor(p?: UserSituation.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserSituation userId. */
    userId: number;

    /** UserSituation situationId. */
    situationId: number;

    /** UserSituation level. */
    level: number;

    /** UserSituation exp. */
    exp: number;

    /** UserSituation createdAt. */
    createdAt: number;

    /** UserSituation addExp. */
    addExp: number;

    /** UserSituation trainingStatus. */
    trainingStatus: string;

    /** UserSituation duplicateCount. */
    duplicateCount: number;

    /** UserSituation illust. */
    illust: string;

    /** UserSituation skillExp. */
    skillExp: number;

    /** UserSituation skillLevel. */
    skillLevel: number;

    /** UserSituation userAppendParameter. */
    userAppendParameter?: (UserAppendParameter.$Properties|null);

    /** UserSituation limitBreakRank. */
    limitBreakRank: number;

    /**
     * Decodes a UserSituation message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserSituation & UserSituation.$Shape} UserSituation
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserSituation & UserSituation.$Shape;
}

export namespace UserSituation {

    /** Properties of a UserSituation. */
    interface $Properties {

        /** UserSituation userId */
        userId?: (number|null);

        /** UserSituation situationId */
        situationId?: (number|null);

        /** UserSituation level */
        level?: (number|null);

        /** UserSituation exp */
        exp?: (number|null);

        /** UserSituation createdAt */
        createdAt?: (number|null);

        /** UserSituation addExp */
        addExp?: (number|null);

        /** UserSituation trainingStatus */
        trainingStatus?: (string|null);

        /** UserSituation duplicateCount */
        duplicateCount?: (number|null);

        /** UserSituation illust */
        illust?: (string|null);

        /** UserSituation skillExp */
        skillExp?: (number|null);

        /** UserSituation skillLevel */
        skillLevel?: (number|null);

        /** UserSituation userAppendParameter */
        userAppendParameter?: (UserAppendParameter.$Properties|null);

        /** UserSituation limitBreakRank */
        limitBreakRank?: (number|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserSituation. */
    type $Shape = UserSituation.$Properties;
}

/**
 * Properties of a UserSituationList.
 * @deprecated Use UserSituationList.$Properties instead.
 */
export interface IUserSituationList extends UserSituationList.$Properties {
}

/** Represents a UserSituationList. */
export class UserSituationList {

    /**
     * Constructs a new UserSituationList.
     * @param [p] Properties to set
     */
    constructor(p?: UserSituationList.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserSituationList entries. */
    entries: UserSituation.$Properties[];

    /**
     * Decodes a UserSituationList message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserSituationList & UserSituationList.$Shape} UserSituationList
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserSituationList & UserSituationList.$Shape;
}

export namespace UserSituationList {

    /** Properties of a UserSituationList. */
    interface $Properties {

        /** UserSituationList entries */
        entries?: (UserSituation.$Properties[]|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserSituationList. */
    type $Shape = UserSituationList.$Properties;
}

/**
 * Properties of a UserVersusMusicRankingResponse.
 * @deprecated Use UserVersusMusicRankingResponse.$Properties instead.
 */
export interface IUserVersusMusicRankingResponse extends UserVersusMusicRankingResponse.$Properties {
}

/** Represents a UserVersusMusicRankingResponse. */
export class UserVersusMusicRankingResponse {

    /**
     * Constructs a new UserVersusMusicRankingResponse.
     * @param [p] Properties to set
     */
    constructor(p?: UserVersusMusicRankingResponse.$Properties);

    /** Unknown fields preserved while decoding when enabled */
    $unknowns?: Uint8Array[];

    /** UserVersusMusicRankingResponse musicId. */
    musicId: number;

    /** UserVersusMusicRankingResponse scoreNearUsers. */
    scoreNearUsers?: (RankingUserList.$Properties|null);

    /** UserVersusMusicRankingResponse scoreTopUsers. */
    scoreTopUsers?: (RankingUserList.$Properties|null);

    /** UserVersusMusicRankingResponse scoreBorderUsers. */
    scoreBorderUsers?: (RankingUserList.$Properties|null);

    /**
     * Decodes a UserVersusMusicRankingResponse message from the specified reader or buffer.
     * @param r Reader or buffer to decode from
     * @param [l] Message length if known beforehand
     * @returns {UserVersusMusicRankingResponse & UserVersusMusicRankingResponse.$Shape} UserVersusMusicRankingResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    static decode(r: ($protobuf.Reader|Uint8Array), l?: number): UserVersusMusicRankingResponse & UserVersusMusicRankingResponse.$Shape;
}

export namespace UserVersusMusicRankingResponse {

    /** Properties of a UserVersusMusicRankingResponse. */
    interface $Properties {

        /** UserVersusMusicRankingResponse musicId */
        musicId?: (number|null);

        /** UserVersusMusicRankingResponse scoreNearUsers */
        scoreNearUsers?: (RankingUserList.$Properties|null);

        /** UserVersusMusicRankingResponse scoreTopUsers */
        scoreTopUsers?: (RankingUserList.$Properties|null);

        /** UserVersusMusicRankingResponse scoreBorderUsers */
        scoreBorderUsers?: (RankingUserList.$Properties|null);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];
    }

    /** Shape of a UserVersusMusicRankingResponse. */
    type $Shape = UserVersusMusicRankingResponse.$Properties;
}
