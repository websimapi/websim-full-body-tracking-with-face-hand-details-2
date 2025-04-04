import { config } from './config.js';
import { initBodyTracking, updateBodyMesh, hideBodyMesh, POSE_CONNECTIONS } from './bodyTracking.js';
import { initFaceTracking, updateFaceMesh, hideFaceMesh, FACEMESH_TESSELATION, FACEMESH_CONTOURS } from './faceTracking.js';
import { initHandTracking, updateHandMesh, hideHandMesh, HAND_CONNECTIONS } from './handTracking.js';
import { createBone, updateBone } from './utils.js';
import { updateHumanoidPose, hideHumanoid } from './humanoidUtils.js'; 
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; 

// Global references to MediaPipe objects now loaded via script tags
const Holistic = window.Holistic;
const drawConnectors = window.drawConnectors;
const drawLandmarks = window.drawLandmarks;
const Camera = window.Camera;
const THREE = window.THREE;

// DOM Elements
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');
const sceneContainer = document.getElementById('scene-container');

// Control checkboxes
const showBodyCheckbox = document.getElementById('show-body');
const showFaceCheckbox = document.getElementById('show-face');
const showHandsCheckbox = document.getElementById('show-hands');
const showHumanoidCheckbox = document.getElementById('show-humanoid'); 

// Tracking state
let holistic;
let camera;

// Three.js objects
let scene, renderer, camera3D;
let bodyMesh = {};
let faceMesh = {};
let leftHandMesh = {};
let rightHandMesh = {};
let humanoidModel = null; 
let humanoidMixer = null; 
let humanoidBones = {}; 
let modelReady = false;

// Initialize the application
async function init() {
    try {
        statusElement.textContent = "Initializing holistic model...";

        // Disable humanoid checkbox initially until model is loaded/fails
        showHumanoidCheckbox.disabled = true;
        showHumanoidCheckbox.checked = false; // Ensure it starts unchecked

        // Initialize the holistic model
        holistic = new Holistic({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137/${file}`;
            }
        });
        
        // Configure the model with settings from config.js
        holistic.setOptions(config.modelSettings);
        
        // Set up the callback for processing results
        holistic.onResults(onResults);
        
        // Set up the camera
        camera = new Camera(video, {
            onFrame: async () => {
                await holistic.send({ image: video });
            },
            width: config.camera.width,
            height: config.camera.height,
            fps: config.camera.fps
        });
        
        // Initialize Three.js scene
        initThreeJS();
        
        // Load the humanoid model
        loadHumanoidModel(); // This will enable the checkbox on success

        // Start the camera
        await camera.start();
        
        // Resize canvas to match video dimensions
        resizeCanvasToDisplaySize();
        
        statusElement.textContent = "Tracking active";
    } catch (error) {
        console.error("Error initializing:", error);
        statusElement.textContent = "Error: " + error.message;
    }
}

// Initialize Three.js scene
function initThreeJS() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.threeJS.background);

    // Create camera
    camera3D = new THREE.PerspectiveCamera(75, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 1000);
    camera3D.position.set(0, 0, 3); 
    camera3D.lookAt(0, -0.5, 0); 

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    sceneContainer.appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); 
    directionalLight.position.set(1, 2, 3);
    scene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight2.position.set(-1, -1, -2);
    scene.add(directionalLight2);


    // Initialize avatar meshes (stick figure)
    bodyMesh = initBodyTracking(scene, THREE, config);
    faceMesh = initFaceTracking(scene, THREE, config);
    leftHandMesh = initHandTracking(scene, THREE, config, 'left');
    rightHandMesh = initHandTracking(scene, THREE, config, 'right');

    // Handle window resize
    window.addEventListener('resize', () => {
        camera3D.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
        camera3D.updateProjectionMatrix();
        renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    });

    // Start animation loop
    animate();
}

// Load the humanoid GLTF model
function loadHumanoidModel() {
    const loader = new GLTFLoader();
    const modelPath = 'humanoid.glb'; 

    statusElement.textContent = `Loading humanoid model (${modelPath})...`;

    loader.load(
        modelPath,
        (gltf) => {
            humanoidModel = gltf.scene;
            humanoidModel.scale.set(1.5, 1.5, 1.5); 
            humanoidModel.position.set(0, -1.5, 0); 
            humanoidModel.visible = false; 

            humanoidModel.traverse((object) => {
                if (object.isBone) {
                    humanoidBones[object.name] = object;
                }
                if (object.isMesh) {
                    // Adjust material properties for better appearance
                    object.castShadow = true; // Allow casting shadows
                    object.receiveShadow = true; // Allow receiving shadows
                    if (object.material) {
                         // Ensure metalness and roughness are applied if material exists
                         object.material.metalness = 0.1;
                         object.material.roughness = 0.8;
                    }
                }
            });

            scene.add(humanoidModel);
            modelReady = true;
            statusElement.textContent = "Humanoid model loaded. Tracking active.";
            console.log("Humanoid model loaded successfully.", humanoidBones);
            showHumanoidCheckbox.disabled = false; // Enable checkbox on successful load
        },
        (xhr) => {
            // Optional: Update status with loading progress
            // const percentLoaded = (xhr.loaded / xhr.total * 100).toFixed(0);
            // statusElement.textContent = `Loading humanoid model... ${percentLoaded}%`;
        },
        (error) => {
            console.error('Error loading GLTF model:', error);
            statusElement.textContent = "Error loading humanoid model. Stick figure only.";
            showHumanoidCheckbox.disabled = true; // Keep disabled on error
            showHumanoidCheckbox.checked = false;
            modelReady = false; // Ensure modelReady is false
        }
    );
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera3D);
}

// Handle window resize
window.addEventListener('resize', resizeCanvasToDisplaySize);

function resizeCanvasToDisplaySize() {
    const vidWidth = video.clientWidth;
    const vidHeight = video.clientHeight;

    canvas.width = vidWidth;
    canvas.height = vidHeight;
}

// Update the 3D scene with new pose data
function updateThreeJSPose(results) {
    // Ensure checkbox state is only considered if model is ready AND checkbox is not disabled
    const showHumanoid = modelReady && !showHumanoidCheckbox.disabled && showHumanoidCheckbox.checked;

    if (showHumanoid) {
        if (humanoidModel) {
            humanoidModel.visible = true;
            updateHumanoidPose(results, humanoidBones, THREE); 
        }
        hideBodyMesh(bodyMesh);
        hideFaceMesh(faceMesh);
        hideHandMesh(leftHandMesh);
        hideHandMesh(rightHandMesh);
    } else {
        if (humanoidModel) {
            hideHumanoid(humanoidModel); 
        }

        if (showBodyCheckbox.checked && results.poseLandmarks) {
            updateBodyMesh(
                results.poseLandmarks,
                bodyMesh,
                updateBone,
                results.leftHandLandmarks,
                results.rightHandLandmarks
            );
        } else {
            hideBodyMesh(bodyMesh);
        }

        if (showFaceCheckbox.checked && results.faceLandmarks) {
            updateFaceMesh(results.faceLandmarks, faceMesh, updateBone);
        } else {
            hideFaceMesh(faceMesh);
        }

        if (showHandsCheckbox.checked) {
            if (results.leftHandLandmarks) {
                updateHandMesh(results.leftHandLandmarks, leftHandMesh, updateBone);
            } else {
                hideHandMesh(leftHandMesh);
            }
            if (results.rightHandLandmarks) {
                updateHandMesh(results.rightHandLandmarks, rightHandMesh, updateBone);
            } else {
                hideHandMesh(rightHandMesh);
            }
        } else {
            hideHandMesh(leftHandMesh);
            hideHandMesh(rightHandMesh);
        }
    }
}

// Process and visualize the tracking results
function onResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results || !results.poseLandmarks) return; 

    updateThreeJSPose(results);

    const showHumanoid = modelReady && !showHumanoidCheckbox.disabled && showHumanoidCheckbox.checked;

    if (showBodyCheckbox.checked && !showHumanoid && results.poseLandmarks) { 
        drawConnectors(
            ctx, results.poseLandmarks, POSE_CONNECTIONS,
            { color: config.colors.body.connectors }
        );
        const bodyLandmarkIndices = {};
        results.poseLandmarks.forEach((lm, index) => {
            if (index >= 11) {
                bodyLandmarkIndices[index] = lm;
            }
        });
        drawLandmarks(
            ctx, Object.values(bodyLandmarkIndices),
            { color: config.colors.body.landmarks, radius: config.pointSizes.body }
        );
    }

    if (showFaceCheckbox.checked && !showHumanoid) { 
        if (results.faceLandmarks) {
            drawLandmarks(
                ctx, results.faceLandmarks,
                { color: config.colors.face.landmarks, radius: config.pointSizes.face }
            );
            drawConnectors(
                ctx, results.faceLandmarks, FACEMESH_TESSELATION,
                { color: config.colors.face.mesh, lineWidth: 0.5 }
            );
            drawConnectors(
                ctx, results.faceLandmarks, FACEMESH_CONTOURS,
                { color: config.colors.face.connectors }
            );
        }
    }

    if (showHandsCheckbox.checked && !showHumanoid) { 
        if (results.leftHandLandmarks) {
            drawConnectors(
                ctx, results.leftHandLandmarks, HAND_CONNECTIONS,
                { color: config.colors.leftHand.connectors }
            );
            drawLandmarks(
                ctx, results.leftHandLandmarks,
                { color: config.colors.leftHand.landmarks, radius: config.pointSizes.hand }
            );
        }
        if (results.rightHandLandmarks) {
            drawConnectors(
                ctx, results.rightHandLandmarks, HAND_CONNECTIONS,
                { color: config.colors.rightHand.connectors }
            );
            drawLandmarks(
                ctx, results.rightHandLandmarks,
                { color: config.colors.rightHand.landmarks, radius: config.pointSizes.hand }
            );
        }
    }
}

// Initialize the app when the page loads
window.addEventListener('DOMContentLoaded', init);