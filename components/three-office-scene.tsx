'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Execution, Workflow, WorkflowNode } from '@/lib/n8n-types';

type Props = {
  workflows: Workflow[];
  executions: Execution[];
  light: boolean;
  zoom: number;
  selectedWorkflowId?: string;
  selectedNodeId?: string;
  resetViewKey: number;
  labelsVisible: boolean;
  layoutMode: 'floor' | 'islands';
  runningWorkflowId?: string;
  onZoomChange: (zoom: number) => void;
  onInspect: (workflow: Workflow, node?: WorkflowNode) => void;
};

const colors = ['#5adeb7', '#8fd3f4', '#eadc8f', '#e69393', '#98a5ef', '#bfa2e3'];
const nodeColors = ['#59c7bb', '#759fe8', '#a784df', '#de9561', '#d16f7d', '#c9a84f', '#5ba77d', '#ba77a8'];
const skins = ['#e8b98e', '#f0c9a0', '#c68b59', '#d89f70', '#f5d5b0'];
const hairs = ['#2b211c', '#171719', '#5a2d16', '#3a302b', '#1c2530'];
const n8nCoreIconRoot = 'https://raw.githubusercontent.com/n8n-io/n8n/master/packages/frontend/@n8n/design-system/src/components/N8nIcon/nodes';
const n8nNodeIconRoot = 'https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/nodes';
const coreNodeIcons: Record<string, string> = {
  agent: 'ai-agent', aggregate: 'aggregate', aiTransform: 'ai-transform', chainLlm: 'basic-llm-chain', chatTrigger: 'chat-trigger', code: 'code', compression: 'compression', convertToFile: 'convert-to-file', crypto: 'crypto', dataTable: 'data-table', dateTime: 'date-and-time', editFields: 'edit-fields', editImage: 'edit-image', emailReadImap: 'email-trigger', errorTrigger: 'error-trigger', executeCommand: 'execute-command', executeWorkflow: 'execute-sub-workflow', executeWorkflowTrigger: 'sub-workflow-trigger', extractFromFile: 'extract-from-file', filter: 'filter', formTrigger: 'form-trigger', ftp: 'ftp', html: 'html', httpRequest: 'http-request', httpRequestTool: 'http-request', if: 'if', limit: 'limit', localFileTrigger: 'local-file-trigger', splitInBatches: 'loop-over-items', manualTrigger: 'manual-trigger', markdown: 'markdown', merge: 'merge', n8n: 'n8n', n8nTrigger: 'n8n-trigger', noOp: 'no-operation', removeDuplicates: 'remove-duplicates', renameKeys: 'rename-keys', respondToWebhook: 'respond-to-webhook', rssFeedRead: 'rss-read', scheduleTrigger: 'schedule-trigger', cron: 'schedule-trigger', emailSend: 'send-mail', sort: 'sort', splitOut: 'split-out', ssh: 'ssh', stopAndError: 'stop-and-error', summarize: 'summarize', switch: 'switch', wait: 'wait', webhook: 'webhook', workflowTrigger: 'sub-workflow-trigger', xml: 'xml',
};
const integrationNodeIcons: Record<string, string> = {
  airtable: `${n8nNodeIconRoot}/Airtable/airtable.svg`, airtableTrigger: `${n8nNodeIconRoot}/Airtable/airtable.svg`, discord: `${n8nNodeIconRoot}/Discord/discord.svg`, github: `${n8nNodeIconRoot}/Github/github.svg`, githubTrigger: `${n8nNodeIconRoot}/Github/github.svg`, gmail: `${n8nNodeIconRoot}/Google/Gmail/gmail.svg`, googleSheets: `${n8nNodeIconRoot}/Google/Sheet/googleSheets.svg`, googleSheetsTrigger: `${n8nNodeIconRoot}/Google/Sheet/googleSheets.svg`, openAi: `${n8nNodeIconRoot}/OpenAi/openAi.svg`, slack: `${n8nNodeIconRoot}/Slack/slack.svg`, slackTrigger: `${n8nNodeIconRoot}/Slack/slack.svg`, telegram: `${n8nNodeIconRoot}/Telegram/telegram.svg`, telegramTrigger: `${n8nNodeIconRoot}/Telegram/telegram.svg`,
};

function nodeTypeName(type: string) { return type.split('.').at(-1) || type; }
function nodeColor(type: string, index: number) {
  const name = nodeTypeName(type).toLowerCase();
  if (/webhook|trigger/.test(name)) return '#dc6c5b';
  if (/code|function/.test(name)) return '#8e7bd8';
  if (/if|switch|filter/.test(name)) return '#c8a34f';
  if (/http|request/.test(name)) return '#4faeb6';
  if (/openai|agent|chain|chat/.test(name)) return '#ac76c8';
  if (/mail|gmail|email/.test(name)) return '#cc7580';
  let hash = index;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return nodeColors[Math.abs(hash) % nodeColors.length];
}
function nodeIconUrl(type: string) {
  const name = nodeTypeName(type);
  if (integrationNodeIcons[name]) return integrationNodeIcons[name];
  return `${n8nCoreIconRoot}/${coreNodeIcons[name] || 'n8n'}.svg`;
}
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}

function roundBox(w: number, d: number, h: number, radius: number, material: THREE.Material) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + w - radius, y); shape.quadraticCurveTo(x + w, y, x + w, y + radius);
  shape.lineTo(x + w, y + d - radius); shape.quadraticCurveTo(x + w, y + d, x + w - radius, y + d);
  shape.lineTo(x + radius, y + d); shape.quadraticCurveTo(x, y + d, x, y + d - radius);
  shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 5 });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function standard(color: string, roughness = .84, metalness = .02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function buildDesk(chip: string, dark: boolean, iconTexture: THREE.Texture) {
  const group = new THREE.Group();
  const wood = dark ? '#8a6b4d' : '#dcc29a';
  const shell = dark ? '#26272a' : '#f7f7f2';
  const top = roundBox(4.6, 2.35, .2, .16, standard(wood)); top.position.y = 1.75; group.add(top);
  const p1 = roundBox(.72, 1.9, 1.55, .1, standard(shell)); p1.position.set(-1.72, .2, 0); group.add(p1);
  const p2 = roundBox(.72, 1.9, 1.55, .1, standard(shell)); p2.position.set(1.72, .2, 0); group.add(p2);
  const screenBack = roundBox(2.05, .12, 1.22, .08, standard('#25262a')); screenBack.position.set(0, 2.28, -.72); group.add(screenBack);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.02), new THREE.MeshBasicMaterial({ color: '#f7f6f2' }));
  screen.position.set(0, 2.9, -.65); screen.rotation.x = 0; group.add(screen);
  const icon = new THREE.Mesh(new THREE.PlaneGeometry(.7, .7), new THREE.MeshBasicMaterial({ map: iconTexture, transparent: true, depthWrite: false }));
  icon.position.set(0, 2.9, -.635); group.add(icon);
  const glow = new THREE.PointLight(chip, dark ? 1.4 : .35, 8); glow.position.set(0, 2.7, 0); group.add(glow);
  const keyboard = roundBox(1.3, .42, .06, .05, standard(dark ? '#47484d' : '#efefea')); keyboard.position.set(0, 1.98, .32); group.add(keyboard);
  return group;
}

function buildPerson(chip: string, index: number, dark: boolean) {
  const group = new THREE.Group();
  const shirt = standard(index === 0 ? (dark ? '#d7d8df' : '#2b3245') : chip);
  const skin = standard(skins[index % skins.length], .7);
  const hair = standard(hairs[index % hairs.length], .95);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.34, .72, 4, 10), shirt); torso.position.y = 1.45; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.43, 16, 14), skin); head.position.y = 2.35; head.castShadow = true; group.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.46, 16, 9, 0, Math.PI * 2, 0, Math.PI * .55), hair); cap.position.y = 2.42; group.add(cap);
  const armGeo = new THREE.CapsuleGeometry(.12, .5, 3, 8);
  const left = new THREE.Mesh(armGeo, shirt); left.position.set(-.43, 1.48, -.2); left.rotation.x = -1.05; left.rotation.z = .25; group.add(left);
  const right = new THREE.Mesh(armGeo, shirt); right.position.set(.43, 1.48, -.2); right.rotation.x = -1.05; right.rotation.z = -.25; group.add(right);
  group.userData.anim = { left, right, phase: index * .73 };
  return group;
}

function positionPods(count: number) {
  if (count <= 1) return [{ x: -15, z: -13 }];
  const points: { x: number; z: number }[] = [];
  const inner = Math.min(count, 6);
  for (let i = 0; i < inner; i++) {
    const angle = -Math.PI * .78 + i * Math.PI * 2 / inner;
    points.push({ x: Math.cos(angle) * 28, z: Math.sin(angle) * 25 });
  }
  const outer = count - inner;
  for (let i = 0; i < outer; i++) {
    const angle = -Math.PI * .68 + i * Math.PI * 2 / outer;
    points.push({ x: Math.cos(angle) * 48, z: Math.sin(angle) * 43 });
  }
  return points;
}

function islandNodePosition(index: number, count: number) {
  if (count <= 1) return { x: 0, z: 1.4 };
  if (count <= 8) {
    const span = Math.PI * 1.38;
    const angle = -span / 2 + (index / (count - 1)) * span;
    const radius = Math.max(11, count * 1.75);
    return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius * .68 + 1.4 };
  }
  const angle = index * 2.28 - Math.PI * .68;
  const radius = 5.5 + Math.sqrt(index + 1) * 4.4;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius * .78 + 1.4 };
}

type BridgeRuntime = {
  workflowId: string;
  root: THREE.Group;
  base: THREE.Mesh;
  top: THREE.Mesh;
  lane: THREE.Mesh;
  runner: THREE.Group;
  curve: THREE.QuadraticBezierCurve3;
  phase: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
};

function bridgeTerminals(from: THREE.Vector3, to: THREE.Vector3) {
  const direction = to.clone().sub(from);
  const distance = direction.length();
  if (distance < .01) return { start: from.clone(), end: to.clone() };
  direction.divideScalar(distance);
  const distanceToEdge = Math.min(
    Math.abs(direction.x) > .001 ? 3.12 / Math.abs(direction.x) : Infinity,
    Math.abs(direction.z) > .001 ? 2.38 / Math.abs(direction.z) : Infinity,
  );
  const inset = Math.max(0, distanceToEdge - .3);
  return {
    start: from.clone().addScaledVector(direction, inset),
    end: to.clone().addScaledVector(direction, -inset),
  };
}

function updateBridge(runtime: BridgeRuntime) {
  const { start, end } = bridgeTerminals(runtime.from, runtime.to);
  const midpoint = start.clone().lerp(end, .5);
  const length = Math.max(.5, start.distanceTo(end));
  runtime.root.position.copy(midpoint);
  runtime.root.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
  runtime.base.scale.x = length;
  runtime.top.scale.x = length;
  runtime.lane.scale.x = Math.max(.2, length - .7);
  runtime.curve = new THREE.QuadraticBezierCurve3(
    start.clone().setY(.22),
    midpoint.clone().setY(.22),
    end.clone().setY(.22),
  );
}

function buildBridge(edgeColor: string, light: boolean) {
  const root = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({ color: light ? '#bebdb4' : '#343437', roughness: .9 });
  const topMaterial = new THREE.MeshStandardMaterial({ color: light ? '#deddd4' : '#555456', roughness: .86, emissive: edgeColor, emissiveIntensity: light ? .015 : .035 });
  const laneMaterial = new THREE.MeshStandardMaterial({ color: edgeColor, roughness: .68, emissive: edgeColor, emissiveIntensity: light ? .08 : .22 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, .78, 1.62), baseMaterial);
  base.position.y = -.36; base.castShadow = true; base.receiveShadow = true; root.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1, .13, 1.46), topMaterial);
  top.position.y = .095; top.castShadow = true; top.receiveShadow = true; root.add(top);
  const lane = new THREE.Mesh(new THREE.BoxGeometry(1, .035, .13), laneMaterial);
  lane.position.y = .18; lane.receiveShadow = true; root.add(lane);
  return { root, base, top, lane };
}

function buildCourier(color: string, dark: boolean) {
  const courier = new THREE.Group();
  const uniform = standard(color, .72);
  const skin = standard('#d9a477', .74);
  const darkMaterial = standard(dark ? '#16171a' : '#34363a', .9);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .42, 3, 8), uniform); body.position.y = .75; body.castShadow = true; courier.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), skin); head.position.y = 1.22; head.castShadow = true; courier.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.235, 12, 7, 0, Math.PI * 2, 0, Math.PI * .5), darkMaterial); hair.position.y = 1.27; courier.add(hair);
  const legGeometry = new THREE.CapsuleGeometry(.07, .28, 2, 6);
  const leftLeg = new THREE.Mesh(legGeometry, darkMaterial); leftLeg.position.set(-.1, .3, 0); courier.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeometry, darkMaterial); rightLeg.position.set(.1, .3, 0); courier.add(rightLeg);
  const parcel = new THREE.Mesh(new THREE.BoxGeometry(.42, .3, .28), standard(dark ? '#d6c29a' : '#8a6845', .78)); parcel.position.set(0, .75, -.28); parcel.castShadow = true; courier.add(parcel);
  const glow = new THREE.PointLight(color, dark ? 1.7 : .45, 4); glow.position.y = .72; courier.add(glow);
  courier.userData.walk = { leftLeg, rightLeg };
  return courier;
}

export function ThreeOfficeScene({ workflows, executions, light, zoom, selectedWorkflowId, selectedNodeId, resetViewKey, labelsVisible, layoutMode, runningWorkflowId, onZoomChange, onInspect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef(onInspect);
  const zoomCallbackRef = useRef(onZoomChange);
  const zoomRef = useRef(zoom);
  const resetRef = useRef(resetViewKey);
  const labelsRef = useRef(labelsVisible);
  const viewTargetRef = useRef({ x: 0, y: 0, z: 0 });
  useEffect(() => { callbackRef.current = onInspect; }, [onInspect]);
  useEffect(() => { zoomCallbackRef.current = onZoomChange; }, [onZoomChange]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { resetRef.current = resetViewKey; }, [resetViewKey]);
  useEffect(() => { labelsRef.current = labelsVisible; }, [labelsVisible]);

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const camera = new THREE.OrthographicCamera(-40, 40, 25, -25, -300, 600);
    const target = new THREE.Vector3(viewTargetRef.current.x, viewTargetRef.current.y, viewTargetRef.current.z);
    const iso = new THREE.Vector3(1, .92, 1).normalize();
    camera.position.copy(target).addScaledVector(iso, 180); camera.lookAt(target);

    const hemi = new THREE.HemisphereLight(light ? 0xfdfff8 : 0x8e95a3, light ? 0xd8d4c8 : 0x14151a, light ? 1.1 : .85); scene.add(hemi);
    const key = new THREE.DirectionalLight(light ? 0xfff1dd : 0xe4e9f2, light ? 2.3 : 1.7); key.position.set(-70, 100, 30); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -110; key.shadow.camera.right = 110; key.shadow.camera.top = 110; key.shadow.camera.bottom = -110; scene.add(key);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: light ? .13 : .34 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -4.4; ground.receiveShadow = true; scene.add(ground);

    const labelLayer = document.createElement('div'); labelLayer.className = `three-office-labels ${labelsRef.current ? 'labels-visible' : 'labels-hidden'}`; host.appendChild(labelLayer);
    const textureLoader = new THREE.TextureLoader();
    const loadedTextures: THREE.Texture[] = [];
    const projected: { element: HTMLElement; point: THREE.Vector3 }[] = [];
    const people: THREE.Group[] = [];
    const pulses: { mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; phase: number }[] = [];
    const floorEdgeRuntimes: { workflowId: string; line: THREE.Line; pulse: THREE.Mesh }[] = [];
    const bridgeRuntimes: BridgeRuntime[] = [];
    const activityLights: { workflowId: string; light: THREE.PointLight }[] = [];
    const islandRuntimes = new Map<string, { root: THREE.Group; pod: THREE.Group; workflowId: string; nodeId: string; position: THREE.Vector3; labelPoint: THREE.Vector3 }>();
    const clickables: THREE.Object3D[] = [];
    const pods = positionPods(workflows.length);
    const world = new THREE.Group(); scene.add(world);
    let savedIslandPositions: Record<string, { x: number; z: number }> = {};
    try { savedIslandPositions = JSON.parse(localStorage.getItem('operator-island-positions') || '{}') as Record<string, { x: number; z: number }>; } catch { savedIslandPositions = {}; }

    function addLabel(className: string, html: string, point: THREE.Vector3, workflow: Workflow, node?: WorkflowNode) {
      const button = document.createElement('button'); button.className = className; button.innerHTML = html;
      button.dataset.workflowId = workflow.id;
      if (node) button.dataset.nodeId = node.id;
      if ((node && node.id === selectedNodeId) || (!node && workflow.id === selectedWorkflowId)) button.classList.add('is-selected');
      if (executions.some(run => run.workflowId === workflow.id && (run.status === 'running' || run.status === 'new'))) button.classList.add('is-running');
      button.addEventListener('click', event => { event.stopPropagation(); callbackRef.current(workflow, node); });
      const item = { element: button, point };
      labelLayer.appendChild(button); projected.push(item);
      return item;
    }

    workflows.forEach((workflow, wi) => {
      const chip = colors[wi % colors.length], pos = pods[wi];
      const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(Math.max(1, workflow.nodes.length)))));
      const rows = Math.max(1, Math.ceil(Math.max(1, workflow.nodes.length) / cols));
      const width = Math.max(19, cols * 8.4 + 3), depth = Math.max(15, rows * 7.2 + 5);
      const pod = new THREE.Group(); pod.position.set(pos.x, 0, pos.z); world.add(pod);
      const floorColor = light ? new THREE.Color(chip).lerp(new THREE.Color('#ffffff'), .82) : new THREE.Color('#1b1c1a').lerp(new THREE.Color(chip), .22);
      if (layoutMode === 'floor') {
        const body = roundBox(width, depth, 3, .9, standard(light ? '#f7f7f2' : '#2c2d2b')); body.position.y = -3; pod.add(body);
        const floor = roundBox(width - .65, depth - .65, .14, .72, new THREE.MeshStandardMaterial({ color: floorColor, roughness: .88 })); floor.position.y = .02; pod.add(floor);
        body.userData.workflowId = workflow.id; floor.userData.workflowId = workflow.id; clickables.push(body, floor);
      }

      const nodePositions = new Map<string, THREE.Vector3>();
      const nodeColorByName = new Map<string, string>();
      const islandGroups = new Map<string, THREE.Group>();
      workflow.nodes.forEach((node, ni) => {
        const col = ni % cols, row = Math.floor(ni / cols);
        const arranged = layoutMode === 'islands' ? islandNodePosition(ni, workflow.nodes.length) : { x: (col - (cols - 1) / 2) * 8.4, z: (row - (rows - 1) / 2) * 7.2 + 1.4 };
        const stored = savedIslandPositions[`${workflow.id}:${node.id}`];
        const x = layoutMode === 'islands' && stored && Number.isFinite(stored.x) ? stored.x : arranged.x;
        const z = layoutMode === 'islands' && stored && Number.isFinite(stored.z) ? stored.z : arranged.z;
        const stationColor = nodeColor(node.type, ni);
        const position = new THREE.Vector3(x, .34, z);
        nodePositions.set(node.name, position);
        nodeColorByName.set(node.name, stationColor);
        if (layoutMode === 'islands') {
          const baseColor = light ? new THREE.Color(stationColor).lerp(new THREE.Color('#f6f4ed'), .58) : new THREE.Color('#1c1c20').lerp(new THREE.Color(stationColor), .38);
          const topColor = light ? new THREE.Color(stationColor).lerp(new THREE.Color('#ffffff'), .76) : new THREE.Color('#25252a').lerp(new THREE.Color(stationColor), .32);
          const islandGroup = new THREE.Group(); islandGroup.position.set(x, 0, z); pod.add(islandGroup); islandGroups.set(node.name, islandGroup);
          const island = roundBox(6.9, 5.55, 1.35, .62, new THREE.MeshStandardMaterial({ color: baseColor, roughness: .86 })); island.position.y = -1.35; islandGroup.add(island);
          const islandTop = roundBox(6.55, 5.2, .13, .55, new THREE.MeshStandardMaterial({ color: topColor, roughness: .82 })); islandTop.position.y = .02; islandGroup.add(islandTop);
          island.userData.workflowId = workflow.id; island.userData.nodeId = node.id; islandTop.userData.workflowId = workflow.id; islandTop.userData.nodeId = node.id; clickables.push(island, islandTop);
        }
      });
      workflow.edges.forEach((edge, ei) => {
        const from = nodePositions.get(edge.from), to = nodePositions.get(edge.to);
        if (!from || !to) return;
        const edgeColor = layoutMode === 'islands' ? nodeColorByName.get(edge.from) || chip : chip;
        if (layoutMode === 'islands') {
          const bridge = buildBridge(edgeColor, light);
          const runner = buildCourier(edgeColor, !light); pod.add(bridge.root, runner);
          const midpoint = from.clone().lerp(to, .5);
          const runtime: BridgeRuntime = {
            workflowId: workflow.id,
            ...bridge,
            runner,
            curve: new THREE.QuadraticBezierCurve3(from, midpoint, to),
            phase: ei / Math.max(1, workflow.edges.length),
            from,
            to,
          };
          updateBridge(runtime); bridgeRuntimes.push(runtime);
        } else {
          const middle = from.clone().lerp(to, .5); middle.y = 1.15;
          const curve = new THREE.QuadraticBezierCurve3(from, middle, to);
          const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: light ? .48 : .78 })); pod.add(path);
          const pulse = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), new THREE.MeshBasicMaterial({ color: light ? edgeColor : '#ffffff' })); pod.add(pulse);
          pulses.push({ mesh: pulse, curve, phase: ei / Math.max(1, workflow.edges.length) });
          floorEdgeRuntimes.push({ workflowId: workflow.id, line: path, pulse });
        }
      });

      workflow.nodes.forEach((node, ni) => {
        const col = ni % cols, row = Math.floor(ni / cols);
        const x = (col - (cols - 1) / 2) * 8.4, z = (row - (rows - 1) / 2) * 7.2 + 1.4;
        const position = nodePositions.get(node.name) || new THREE.Vector3(x, .34, z);
        const islandGroup = islandGroups.get(node.name);
        const station = new THREE.Group(); station.position.set(layoutMode === 'islands' ? 0 : position.x, .14, layoutMode === 'islands' ? 0 : position.z); station.rotation.y = Math.PI / 4;
        (islandGroup || pod).add(station);
        const stationColor = layoutMode === 'islands' ? nodeColorByName.get(node.name) || chip : chip;
        const iconTexture = textureLoader.load(nodeIconUrl(node.type)); iconTexture.colorSpace = THREE.SRGBColorSpace; loadedTextures.push(iconTexture);
        const desk = buildDesk(stationColor, !light, iconTexture); station.add(desk);
        const activityLight = new THREE.PointLight(stationColor, 0, 9);
        activityLight.position.set(0, 3.2, 0); station.add(activityLight);
        activityLights.push({ workflowId: workflow.id, light: activityLight });
        const person = buildPerson(stationColor, ni, !light); person.position.set(0, .35, 1.55); person.rotation.y = Math.PI; station.add(person); people.push(person);
        station.traverse(obj => { obj.userData.workflowId = workflow.id; obj.userData.nodeId = node.id; clickables.push(obj); });
        const labelPoint = new THREE.Vector3(pos.x + position.x + 1.1, .28, pos.z + position.z + 1.1);
        addLabel(`office-agent-pill${node.disabled ? ' is-disabled' : ''}`, `<span class="node-name">${escapeHtml(node.name)}</span>`, labelPoint, workflow, node);
        if (layoutMode === 'islands' && islandGroup) islandRuntimes.set(`${workflow.id}:${node.id}`, { root: islandGroup, pod, workflowId: workflow.id, nodeId: node.id, position, labelPoint });
      });
    });

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const floorPoint = new THREE.Vector3();
    const activePointers = new Map<number, { x: number; y: number }>();
    let dragged = false, dragDistance = 0, pinchDistance = 0, pinchZoom = zoomRef.current;
    let islandDrag: { runtime: { root: THREE.Group; pod: THREE.Group; workflowId: string; nodeId: string; position: THREE.Vector3; labelPoint: THREE.Vector3 }; offsetX: number; offsetZ: number } | null = null;
    const screenRight = new THREE.Vector3(), screenUp = new THREE.Vector3();
    const clampZoom = (value: number) => Math.max(.55, Math.min(3.2, value));
    const hoverLabels = (workflowId?: string, nodeId?: string) => {
      labelLayer.querySelectorAll('.is-hovered').forEach(element => element.classList.remove('is-hovered'));
      if (!workflowId) return;
      labelLayer.querySelectorAll(`[data-workflow-id="${CSS.escape(workflowId)}"]`).forEach(element => {
        if (!nodeId || (element as HTMLElement).dataset.nodeId === nodeId) element.classList.add('is-hovered');
      });
    };
    const setRayAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(pointer, camera);
    };
    const hitAt = (event: PointerEvent) => {
      setRayAt(event);
      return ray.intersectObjects(clickables, false)[0]?.object;
    };
    const pointAtFloor = (event: PointerEvent) => {
      setRayAt(event);
      return ray.ray.intersectPlane(floorPlane, floorPoint) ? floorPoint : null;
    };
    const refreshEdges = (workflowId: string) => {
      bridgeRuntimes.filter(edge => edge.workflowId === workflowId).forEach(updateBridge);
    };
    const onPointerDown = (event: PointerEvent) => {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      dragged = false; dragDistance = 0;
      if (layoutMode === 'islands' && activePointers.size === 1) {
        const hit = hitAt(event);
        const runtime = hit?.userData.nodeId ? islandRuntimes.get(`${hit.userData.workflowId}:${hit.userData.nodeId}`) : undefined;
        const point = runtime ? pointAtFloor(event) : null;
        if (runtime && point) islandDrag = { runtime, offsetX: runtime.position.x - (point.x - runtime.pod.position.x), offsetZ: runtime.position.z - (point.z - runtime.pod.position.z) };
      }
      canvas.style.cursor = activePointers.size === 1 ? 'grabbing' : 'zoom-in';
      if (activePointers.size === 2) {
        islandDrag = null;
        const [a, b] = [...activePointers.values()];
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); pinchZoom = zoomRef.current;
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const previous = activePointers.get(event.pointerId);
      if (!previous) return;
      const next = { x: event.clientX, y: event.clientY };
      activePointers.set(event.pointerId, next);
      if (activePointers.size >= 2) {
        const [a, b] = [...activePointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance > 0) {
          const nextZoom = clampZoom(pinchZoom * distance / pinchDistance);
          zoomRef.current = nextZoom;
          zoomCallbackRef.current(nextZoom);
        }
        dragged = true;
        return;
      }
      const dx = next.x - previous.x, dy = next.y - previous.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      if (dragDistance > 3) dragged = true;
      if (islandDrag) {
        const point = pointAtFloor(event);
        if (point) {
          const localX = Math.max(-42, Math.min(42, point.x - islandDrag.runtime.pod.position.x + islandDrag.offsetX));
          const localZ = Math.max(-38, Math.min(38, point.z - islandDrag.runtime.pod.position.z + islandDrag.offsetZ));
          islandDrag.runtime.position.x = localX; islandDrag.runtime.position.z = localZ;
          islandDrag.runtime.root.position.x = localX; islandDrag.runtime.root.position.z = localZ;
          islandDrag.runtime.labelPoint.x = islandDrag.runtime.pod.position.x + localX + 1.1;
          islandDrag.runtime.labelPoint.z = islandDrag.runtime.pod.position.z + localZ + 1.1;
          refreshEdges(islandDrag.runtime.workflowId);
        }
        return;
      }
      camera.updateMatrixWorld();
      const worldPerPixel = (camera.top - camera.bottom) / Math.max(.01, camera.zoom) / Math.max(1, host.clientHeight);
      screenRight.setFromMatrixColumn(camera.matrixWorld, 0);
      screenUp.setFromMatrixColumn(camera.matrixWorld, 1);
      target.addScaledVector(screenRight, -dx * worldPerPixel).addScaledVector(screenUp, dy * worldPerPixel);
      target.x = Math.max(-95, Math.min(95, target.x));
      target.y = Math.max(-45, Math.min(45, target.y));
      target.z = Math.max(-95, Math.min(95, target.z));
      viewTargetRef.current = { x: target.x, y: target.y, z: target.z };
    };
    const inspectAtPointer = (event: PointerEvent) => {
      const hit = hitAt(event);
      const workflow = workflows.find(item => item.id === hit?.userData.workflowId); const node = workflow?.nodes.find(item => item.id === hit?.userData.nodeId);
      if (workflow) callbackRef.current(workflow, node);
    };
    const onPointerHover = (event: PointerEvent) => {
      if (activePointers.size) return;
      const hit = hitAt(event);
      hoverLabels(hit?.userData.workflowId, hit?.userData.nodeId);
      canvas.style.cursor = layoutMode === 'islands' && hit?.userData.nodeId ? 'move' : 'grab';
    };
    const onPointerLeave = () => { hoverLabels(); if (!activePointers.size) canvas.style.cursor = 'grab'; };
    const onPointerUp = (event: PointerEvent) => {
      const wasDragged = dragged;
      const completedIslandDrag = islandDrag;
      islandDrag = null;
      activePointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = activePointers.size ? 'grabbing' : 'grab';
      if (completedIslandDrag && wasDragged) {
        savedIslandPositions[`${completedIslandDrag.runtime.workflowId}:${completedIslandDrag.runtime.nodeId}`] = { x: Number(completedIslandDrag.runtime.position.x.toFixed(2)), z: Number(completedIslandDrag.runtime.position.z.toFixed(2)) };
        localStorage.setItem('operator-island-positions', JSON.stringify(savedIslandPositions));
      }
      if (!wasDragged && activePointers.size === 0) inspectAtPointer(event);
      if (activePointers.size < 2) pinchDistance = 0;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const nextZoom = clampZoom(zoomRef.current * Math.exp(-event.deltaY * .0018));
      zoomRef.current = nextZoom;
      zoomCallbackRef.current(nextZoom);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointermove', onPointerHover);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const fit = () => {
      const width = host.clientWidth, height = host.clientHeight; renderer.setSize(width, height, false);
      const aspect = width / Math.max(1, height);
      const half = workflows.length <= 1 ? 27 : workflows.length <= 6 ? 48 : 76;
      camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
    };
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(fit);
    });
    observer.observe(host); fit();
    let frame = 0, appliedReset = resetRef.current;
    const vector = new THREE.Vector3();
    const animate = (time: number) => {
      labelLayer.classList.toggle('labels-visible', labelsRef.current);
      labelLayer.classList.toggle('labels-hidden', !labelsRef.current);
      if (appliedReset !== resetRef.current) { target.set(0, 0, 0); viewTargetRef.current = { x: 0, y: 0, z: 0 }; appliedReset = resetRef.current; }
      camera.position.copy(target).addScaledVector(iso, 180); camera.lookAt(target);
      camera.zoom = zoomRef.current; camera.updateProjectionMatrix();
      people.forEach(person => { const anim = person.userData.anim; anim.left.rotation.x = -1.05 + Math.sin(time / 180 + anim.phase) * .12; anim.right.rotation.x = -1.05 + Math.sin(time / 150 + anim.phase + 1.2) * .14; });
      pulses.forEach(pulse => pulse.curve.getPoint((time / 2600 + pulse.phase) % 1, pulse.mesh.position));
      activityLights.forEach(({ workflowId, light: activityLight }) => { activityLight.intensity = workflowId === runningWorkflowId ? 2.4 + Math.sin(time / 170) * .45 : 0; });
      floorEdgeRuntimes.forEach(edge => { const active = edge.workflowId === runningWorkflowId; edge.pulse.scale.setScalar(active ? 1.8 + Math.sin(time / 130) * .35 : 1); (edge.line.material as THREE.LineBasicMaterial).opacity = active ? .98 : (light ? .48 : .78); });
      bridgeRuntimes.forEach(edge => {
        const active = edge.workflowId === runningWorkflowId;
        const raw = (time / (active ? 3100 : 5600) + edge.phase) % 1;
        const progress = raw < .08 ? 0 : raw > .92 ? 1 : THREE.MathUtils.smoothstep(raw, .08, .92);
        edge.curve.getPoint(progress, edge.runner.position);
        const tangent = edge.curve.getTangent(Math.min(.99, progress));
        edge.runner.rotation.y = Math.atan2(tangent.x, tangent.z);
        const walk = edge.runner.userData.walk;
        if (walk) {
          const stride = Math.sin(time / (active ? 80 : 125) + edge.phase * Math.PI * 2) * .5;
          walk.leftLeg.rotation.x = stride; walk.rightLeg.rotation.x = -stride;
          edge.runner.position.y += Math.abs(Math.sin(time / 110 + edge.phase * 4)) * .055;
        }
        edge.runner.scale.setScalar(active ? 1.08 : .82);
        const topMaterial = edge.top.material as THREE.MeshStandardMaterial;
        const laneMaterial = edge.lane.material as THREE.MeshStandardMaterial;
        topMaterial.emissiveIntensity = active ? .2 + Math.sin(time / 190) * .05 : (light ? .015 : .035);
        laneMaterial.emissiveIntensity = active ? 1.25 : (light ? .08 : .22);
      });
      world.children.forEach(child => { if (child.type === 'Group' && child.children[0]?.type === 'Mesh' && child.position.y > 2) child.rotation.y = time / 13000; });
      projected.forEach(item => {
        vector.copy(item.point).project(camera);
        const x = Math.max(58, Math.min(host.clientWidth - 58, (vector.x * .5 + .5) * host.clientWidth));
        const y = Math.max(38, Math.min(host.clientHeight - 58, (-vector.y * .5 + .5) * host.clientHeight));
        item.element.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        item.element.style.opacity = vector.z > 1 ? '0' : '';
      });
      renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointermove', onPointerHover); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerUp); canvas.removeEventListener('pointerleave', onPointerLeave); canvas.removeEventListener('wheel', onWheel);
      labelLayer.remove(); loadedTextures.forEach(texture => texture.dispose());
      scene.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []; mats.forEach(material => material.dispose()); }); renderer.dispose();
    };
  }, [workflows, executions, light, selectedWorkflowId, selectedNodeId, layoutMode, runningWorkflowId]);

  return <div className="three-office-scene" ref={hostRef}><canvas ref={canvasRef} tabIndex={0} aria-label="Interactive 3D workspace. Drag to move, use the wheel or trackpad to zoom, or pinch with two fingers." /></div>;
}
