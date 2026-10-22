export interface TransitionNode { readonly key:string; readonly type:string; readonly topology:string; readonly svg:string; readonly offset:readonly [number,number]; readonly clip:readonly [number,number,number,number]; }
export interface TransitionScene { readonly version:1; readonly width:number; readonly height:number; readonly definitions:string; readonly nodes:readonly TransitionNode[]; }
export declare function planTransition(before:TransitionScene,after:TransitionScene): {updates:{key:string;from:TransitionNode;to:TransitionNode}[];enters:TransitionNode[];exits:TransitionNode[]};
export interface TransitionResult {status:'finished'|'superseded'|'destroyed'}
export interface TransitionPlayer {
 set(scene:TransitionScene):Promise<TransitionResult>;
 transitionTo(scene:TransitionScene,options?:{duration?:number}):Promise<TransitionResult>;
 readonly scene:TransitionScene|null;readonly element:SVGSVGElement;readonly animating:boolean;
 readonly stats:{frames:number;retargets:number;maxFrameMs:number;nodes:number;definitions:number};
 destroy():void;
}
export declare function createTransitionPlayer(host:HTMLElement,options?:{duration?:number;maxAnimatedNodes?:number;onFinish?:(scene:TransitionScene)=>void}):TransitionPlayer;

export interface CanvasTransitionNode { readonly key:string; readonly type:'circle'|'rect'|'line'|'path'|'text'; readonly topology:string; readonly properties:Readonly<Record<string,unknown>>; readonly offset:readonly [number,number]; readonly clip:readonly [number,number,number,number]; }
export interface CanvasTransitionScene { readonly version:2; readonly width:number; readonly height:number; readonly nodes:readonly CanvasTransitionNode[]; }
export interface CanvasTransitionPlayer {
 set(scene:CanvasTransitionScene):Promise<TransitionResult>;
 transitionTo(scene:CanvasTransitionScene,options?:{duration?:number}):Promise<TransitionResult>;
 readonly scene:CanvasTransitionScene|null; readonly element:HTMLCanvasElement; readonly animating:boolean;
 readonly stats:{frames:number;retargets:number;maxFrameMs:number;nodes:number;definitions:number};
 destroy():void;
}
export declare function createCanvasTransitionPlayer(host:HTMLElement,options:{render:(scene:CanvasTransitionScene,context:CanvasRenderingContext2D,options:{pixelRatio:number})=>void;duration?:number;maxAnimatedNodes?:number;onFinish?:(scene:CanvasTransitionScene)=>void}):CanvasTransitionPlayer;
