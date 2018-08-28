/*************************************************************
 *
 *  Copyright (c) 2017 The MathJax Consortium
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/**
 * @fileoverview  Implements the CommonMfrac wrapper mixin for the MmlMfrac object
 *
 * @author dpvc@mathjax.org (Davide Cervone)
 */

import {AnyWrapper, WrapperConstructor} from '../Wrapper.js';
import {CommonMoInterface} from './mo.js';
import {MmlMfrac} from '../../../core/MmlTree/MmlNodes/mfrac.js';
import {BBox} from '../BBox.js';
import {DIRECTION} from '../FontData.js';

/*****************************************************************/
/**
 * The CommonMfrac interface
 */
export interface CommonMfracInterface extends AnyWrapper {
    /**
     * @param {BBox} bbox        The buonding box to modify
     * @param {boolean} display  True for display-mode fractions
     * @param {number} t         The thickness of the line
     */
    getFractionBBox(bbox: BBox, display: boolean, t: number): void;

    /**
     * @param {boolean} display  True for display-mode fractions
     * @param {number} t         The thickness of the line
     * @return {Object}          The expanded rule thickness (T), and baeline offsets
     *                             for numerator and denomunator (u and v)
     */
    getTUV(display: boolean, t: number): {T: number, u: number, v: number};

    /**
     * @param {BBox} bbox        The bounding box to modify
     * @param {boolean} display  True for display-mode fractions
     */
    getAtopBBox(bbox: BBox, display: boolean): void;

    /**
     * @param {boolean} display  True for diplay-mode fractions
     * @return {Object}
     *    The vertical offsets of the numerator (u), the denominator (v),
     *    the separation between the two, and the bboxes themselves.
     */
    getUVQ(display: boolean): {u: number, v: number, q: number, nbox: BBox, dbox: BBox};

    /**
     * @param {BBox} bbox        The boundng box to modify
     * @param {boolean} display  True for display-mode fractions
     */
    getBevelledBBox(bbox: BBox, display: boolean): void;

    /**
     * @param {boolean} display  True for display-style fractions
     * @return {Object}          The height (H) of the bevel, horizontal offest (delta)
     *                             vertical offsets (u and v) of the parts, and
     *                             bounding boxes of the parts.
     */
    getBevelData(display: boolean): {H: number, delta: number, u: number, v:number, nbox: BBox, dbox: BBox};

    /**
     * @return {boolean}   True if in display mode, false otherwise
     */
    isDisplay(): boolean;
}

/**
 * Shorthand for the CommonMfrac constructor
 */
export type MfracConstructor = Constructor<CommonMfracInterface>;

/*****************************************************************/
/**
 * The CommonMfrac wrapper mixin for the MmlMfrac object
 *
 * @template N  The HTMLElement node class
 * @template T  The Text node class
 * @template D  The Document class
 * @template U  The Wrapper class constructor type
 */
export function CommonMfrac<N, T, D, U extends WrapperConstructor>(Base: U): MfracConstructor & U {
    return class extends Base {

        public bevel: CommonMoInterface = null;

        /************************************************/

        /**
         * @override
         * @constructor
         */
        constructor(...args: any[]) {
            super(...args);
            //
            //  create internal bevel mo element
            //
            if (this.node.attributes.get('bevelled')) {
                const {H} = this.getBevelData(this.isDisplay());
                const bevel = this.bevel = this.createMo('/');
                bevel.canStretch(DIRECTION.Vertical);
                bevel.getStretchedVariant([H], true);
            }
        }

        /**
         * @override
         */
        public computeBBox(bbox: BBox) {
            bbox.empty();
            const {linethickness, bevelled} = this.node.attributes.getList('linethickness', 'bevelled');
            const display = this.isDisplay();
            if (bevelled) {
                this.getBevelledBBox(bbox, display);
            } else {
                const thickness = this.length2em(String(linethickness));
                if (thickness === 0) {
                    this.getAtopBBox(bbox, display);
                } else {
                    this.getFractionBBox(bbox, display, thickness);
                }
            }
            bbox.clean();
        }

        /************************************************/

        /**
         * @param {BBox} bbox        The buonding box to modify
         * @param {boolean} display  True for display-mode fractions
         * @param {number} t         The thickness of the line
         */
        public getFractionBBox(bbox: BBox, display: boolean, t: number) {
            const nbox = this.childNodes[0].getBBox();
            const dbox = this.childNodes[1].getBBox();
            const tex = this.font.params;
            const pad = (this.node.getProperty('withDelims') as boolean ? 0 : tex.nulldelimiterspace);
            const a = tex.axis_height;
            const {T, u, v} = this.getTUV(display, t);
            bbox.combine(nbox, 0, a + T + Math.max(nbox.d * nbox.rscale, u));
            bbox.combine(dbox, 0, a - T - Math.max(dbox.h * dbox.rscale, v));
            bbox.w += 2 * pad + .2;
        }

        /**
         * @param {boolean} display  True for display-mode fractions
         * @param {number} t         The thickness of the line
         * @return {Object}          The expanded rule thickness (T), and baeline offsets
         *                             for numerator and denomunator (u and v)
         */
        public getTUV(display: boolean, t: number) {
            const tex = this.font.params;
            const a = tex.axis_height;
            const T = (display ? 3.5 : 1.5) * t;
            return {T: (display ? 3.5 : 1.5) * t,
                    u: (display ? tex.num1 : tex.num2) - a - T,
                    v: (display ? tex.denom1 : tex.denom2) + a - T};
        }

        /************************************************/

        /**
         * @param {BBox} bbox        The bounding box to modify
         * @param {boolean} display  True for display-mode fractions
         */
        public getAtopBBox(bbox: BBox, display: boolean) {
            const tex = this.font.params;
            const pad = (this.node.getProperty('withDelims') as boolean ? 0 : tex.nulldelimiterspace);
            const {u, v, nbox, dbox} = this.getUVQ(display);
            bbox.combine(nbox, 0, u);
            bbox.combine(dbox, 0, -v);
            bbox.w += 2 * pad;
        }

        /**
         * @param {boolean} display  True for diplay-mode fractions
         * @return {Object}
         *    The vertical offsets of the numerator (u), the denominator (v),
         *    the separation between the two, and the bboxes themselves.
         */
        public getUVQ(display: boolean) {
            const nbox = this.childNodes[0].getBBox() as BBox;
            const dbox = this.childNodes[1].getBBox() as BBox;
            const tex = this.font.params;
            //
            //  Initial offsets (u, v)
            //  Minimum separation (p)
            //  Actual separation with initial positions (q)
            //
            let [u, v] = (display ? [tex.num1, tex.denom1] : [tex.num3, tex.denom2]);
            let p = (display ? 7 : 3) * tex.rule_thickness;
            let q = (u - nbox.d * nbox.scale) - (dbox.h * dbox.scale - v);
            //
            //  If actual separation is less than minimum, move them farther apart
            //
            if (q < p) {
                u += (p - q)/2;
                v += (p - q)/2;
                q = p;
            }
            return {u, v, q, nbox, dbox};
        }

        /************************************************/

        /**
         * @param {BBox} bbox        The boundng box to modify
         * @param {boolean} display  True for display-mode fractions
         */
        public getBevelledBBox(bbox: BBox, display: boolean) {
            const {u, v, delta, nbox, dbox} = this.getBevelData(display);
            const lbox = this.bevel.getBBox();
            bbox.combine(nbox, 0, u);
            bbox.combine(lbox, bbox.w - delta / 2, 0);
            bbox.combine(dbox, bbox.w - delta / 2, v);
        }

        /**
         * @param {boolean} display  True for display-style fractions
         * @return {Object}          The height (H) of the bevel, horizontal offest (delta)
         *                             vertical offsets (u and v) of the parts, and
         *                             bounding boxes of the parts.
         */
        public getBevelData(display: boolean) {
            const nbox = this.childNodes[0].getBBox() as BBox;
            const dbox = this.childNodes[1].getBBox() as BBox;
            const delta = (display ? .4 : .15);
            const H = Math.max(nbox.scale * (nbox.h + nbox.d), dbox.scale * (dbox.h + dbox.d)) + 2 * delta;
            const a = this.font.params.axis_height;
            const u = nbox.scale * (nbox.d - nbox.h) / 2 + a + delta;
            const v = dbox.scale * (dbox.d - dbox.h) / 2 + a - delta;
            return {H, delta, u, v, nbox, dbox};
        }

        /************************************************/

        /**
         * @override
         */
        public canStretch(direction: DIRECTION) {
            return false;
        }

        /**
         * @return {boolean}   True if in display mode, false otherwise
         */
        public isDisplay() {
            const {displaystyle, scriptlevel} = this.node.attributes.getList('displaystyle', 'scriptlevel');
            return displaystyle && scriptlevel === 0;
        }

    };

}