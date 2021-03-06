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
 * @fileoverview  Implements the HTMLDomStrings class
 *
 * @author dpvc@mathjax.org (Davide Cervone)
 */

import {userOptions, defaultOptions, OptionList, makeArray} from '../../util/Options.js';
import {DOMAdaptor} from '../../core/DOMAdaptor.js';

/**
 *  List of consecutive text nodes and their text lengths
 *
 * @template N  The HTMLElement node class
 * @template T  The Text node class
 */
export type HTMLNodeList<N, T> = [N | T, number][];

/*****************************************************************/
/**
 *  The HTMLDocument class (extends AbstractMathDocument)
 *
 *  A class for extracting the text from DOM trees
 *
 * @template N  The HTMLElement node class
 * @template T  The Text node class
 * @template D  The Document class
 */
export class HTMLDomStrings<N, T, D> {

    public static OPTIONS: OptionList = {
        skipTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'annotation', 'annotation-xml'],
                                          // The names of the tags whose contents will not be
                                          // scanned for math delimiters

        includeTags: {br: '\n', wbr: '', '#comment': ''},
                                          //  tags to be included in the text (and what
                                          //  text to replace them with)

        ignoreClass: 'tex2jax_ignore',    // the class name of elements whose contents should
                                          // NOT be processed by tex2jax.  Note that this
                                          // is a regular expression, so be sure to quote any
                                          // regexp special characters

        processClass: 'tex2jax_process'   // the class name of elements whose contents SHOULD
                                          // be processed when they appear inside ones that
                                          // are ignored.  Note that this is a regular expression,
                                          // so be sure to quote any regexp special characters
    };

    /**
     * The options for this instance
     */
    protected options: OptionList;

    /**
     * The array of strings found in the DOM
     */
    protected strings: string[];

    /**
     * The string currently being constructed
     */
    protected string: string;

    /**
     * The list of nodes and lengths for the string being constructed
     */
    protected snodes: HTMLNodeList<N, T>;

    /**
     * The list of node lists corresponding to the strings in this.strings
     */
    protected nodes: HTMLNodeList<N, T>[];

    /**
     * The container nodes that are currently being traversed, and whether their
     *  contents are being ignored or not
     */
    protected stack: [N | T, boolean][];

    /**
     * Regular expressions for the tags to be skipped, and which classes should start/stop
     *  processing of math
     */
    protected skipTags: RegExp;
    protected ignoreClass: RegExp;
    protected processClass: RegExp;

    /**
     * The DOM Adaptor to managing HTML elements
     */
    public adaptor: DOMAdaptor<N, T, D>;

    /**
     * @param {OptionList} options  The user-supplied options
     * @constructor
     */
    constructor(options: OptionList = null) {
        let CLASS = this.constructor as typeof HTMLDomStrings;
        this.options = userOptions(defaultOptions({}, CLASS.OPTIONS), options);
        this.init();
        this.getPatterns();
    }

    /**
     * Set the initial values of the main properties
     */
    protected init() {
        this.strings = [];
        this.string = '';
        this.snodes = [];
        this.nodes = [];
        this.stack = [];
    }

    /**
     * Create the search patterns for skipTags, ignoreClass, and processClass
     */
    protected getPatterns() {
        let skip = makeArray(this.options['skipTags']);
        let ignore = makeArray(this.options['ignoreClass']);
        let process = makeArray(this.options['processClass']);
        this.skipTags = new RegExp('^(?:' + skip.join('|') + ')$', 'i');
        this.ignoreClass = new RegExp('(?:^| )(?:' + ignore.join('|') + ')(?: |$)');
        this.processClass = new RegExp('(?:^| )(?:' + process + ')(?: |$)');
    }

    /**
     * Add a string to the string array and record its node list
     */
    protected pushString() {
        if (this.string.match(/\S/)) {
            this.strings.push(this.string);
            this.nodes.push(this.snodes);
        }
        this.string = '';
        this.snodes = [];
    }

    /**
     * Add more text to the current string, and record the
     * node and its position in the string.
     *
     * @param {T} node        The node to be pushed
     * @param {string} text   The text to be added (it may not be the actual text
     *                         of the node, if it is one of the nodes that gets
     *                         translated to text, like <br> to a newline).
     */
    protected extendString(node: N | T, text: string) {
        this.snodes.push([node, text.length]);
        this.string += text;
    }

    /**
     * Handle a #text node (add its text to the current string)
     *
     * @param {T} node          The Text node to process
     * @param {boolean} ignore  Whether we are currently ignoring content
     * @return {N}              The next element to process
     */
    protected handleText(node: T, ignore: boolean) {
        if (!ignore) {
            this.extendString(node, this.adaptor.value(node));
        }
        return this.adaptor.next(node);
    }

    /**
     * Handle a BR, WBR, or #comment element (or others in the includeTag object).
     *
     * @param {N} node          The node to process
     * @param {boolean} ignore  Whether we are currently ignoring content
     * @return {N}              The next element to process
     */
    protected handleTag(node: N, ignore: boolean) {
        if (!ignore) {
            let text = this.options['includeTags'][this.adaptor.kind(node)];
            this.extendString(node, text);
        }
        return this.adaptor.next(node);
    }

    /**
     * Handle an arbitrary DOM node:
     *   Check the class to see if it matches the processClass regex
     *   If the node has a child and is not marked as created by MathJax (data-MJX)
     *       and either it is marked as restarting processing or is not a tag to be skipped, then
     *     Save the next node (if there is one) and whether we are currently ignoring content
     *     Move to the first child node
     *     Update whether we are ignoring content
     *   Otherwise
     *     Move on to the next sibling
     *   Return the next node to process and the ignore state
     *
     * @param {N} node               The node to process
     * @param {boolean} ignore       Whether we are currently ignoring content
     * @return {[N|T, boolean]}      The next element to process and whether to ignore its content
     */
    protected handleContainer(node: N, ignore: boolean) {
        this.pushString();
        const cname = this.adaptor.getAttribute(node, 'class') || '';
        const tname = this.adaptor.kind(node) || '';
        const process = this.processClass.exec(cname);
        let next: N | T = node;
        if (this.adaptor.firstChild(node) && !this.adaptor.getAttribute(node, 'data-MJX') &&
            (process || !this.skipTags.exec(tname))) {
            if (this.adaptor.next(node)) {
                this.stack.push([this.adaptor.next(node), ignore]);
            }
            next = this.adaptor.firstChild(node);
            ignore = (ignore || this.ignoreClass.exec(cname)) && !process;
        } else {
            next = this.adaptor.next(node);
        }
        return [next, ignore] as [N | T, boolean];
    }

    /**
     * Find the strings for a given DOM element:
     *   Initialize the state
     *   Get the element where we stop processing
     *   While we still have a node, and it is not the one where we are to stop:
     *     If it is a text node, handle it and get the next node
     *     Otherwise, if it is in the includeTags list, handle it and get the next node
     *     Otherwise, handle it as a container and get the next node and ignore status
     *     If there is no next node, and there are more nodes on the stack:
     *       Save the current string, and pop the node and ignore status from the stack
     *   Push the final string
     *   Get the string array and array of associated DOM nodes
     *   Clear the internal values (so the memory can be freed)
     *   Return the strings and node lists
     *
     * @param {N} node                       The node to search
     * @return {[string[], HTMLNodeList[]]}  The array of strings and their associated lists of nodes
     */
    public find(node: N | T) {
        this.init();
        let stop = this.adaptor.next(node);
        let ignore = false;
        let include = this.options['includeTags'];

        while (node && node !== stop) {
            if (this.adaptor.kind(node) === '#text') {
                node = this.handleText(node as T, ignore);
            } else if (include[this.adaptor.kind(node)] !== undefined) {
                node = this.handleTag(node as N, ignore);
            } else {
                [node, ignore] = this.handleContainer(node as N, ignore);
            }
            if (!node && this.stack.length) {
                this.pushString();
                [node, ignore] = this.stack.pop();
            }
        }

        this.pushString();
        let result = [this.strings, this.nodes] as [string[], HTMLNodeList<N, T>[]];
        this.init(); // free up memory
        return result;
    }

}
