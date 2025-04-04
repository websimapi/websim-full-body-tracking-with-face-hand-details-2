/**
 * Utilities for controlling a rigged humanoid model based on MediaPipe landmarks.
 */

// --- Configuration ---
const landmarkScaleFactor = 2.5; // Same scale factor used for stick figure
const modelYOffset = -1.5; // Y offset applied to the model in app.js
const modelScale = 1.5;   // Scale applied to the model in app.js

// IMPORTANT: Bone names must match the names in your GLB/GLTF model.
// These are common names found in Mixamo rigs. Adjust them for your specific model.
const BONE_MAPPING = {
    // Body
    Hips: 'mixamorigHips',
    Spine: 'mixamorigSpine',
    Spine1: 'mixamorigSpine1', // Optional lower spine bone
    Spine2: 'mixamorigSpine2', // Optional upper spine bone
    Neck: 'mixamorigNeck',
    Head: 'mixamorigHead',
    // Left Arm
    LeftShoulder: 'mixamorigLeftShoulder',
    LeftArm: 'mixamorigLeftArm', // Upper arm
    LeftForeArm: 'mixamorigLeftForeArm',
    LeftHand: 'mixamorigLeftHand',
    // Right Arm
    RightShoulder: 'mixamorigRightShoulder',
    RightArm: 'mixamorigRightArm', // Upper arm
    RightForeArm: 'mixamorigRightForeArm',
    RightHand: 'mixamorigRightHand',
    // Left Leg
    LeftUpLeg: 'mixamorigLeftUpLeg',
    LeftLeg: 'mixamorigLeftLeg', // Lower leg (shin)
    LeftFoot: 'mixamorigLeftFoot',
    LeftToeBase: 'mixamorigLeftToeBase', // Optional
    // Right Leg
    RightUpLeg: 'mixamorigRightUpLeg',
    RightLeg: 'mixamorigRightLeg', // Lower leg (shin)
    RightFoot: 'mixamorigRightFoot',
    RightToeBase: 'mixamorigRightToeBase', // Optional

    // Hands (fingers - optional, can be complex)
    // Example for Left Hand Fingers (adjust names!)
    LeftHandThumb1: 'mixamorigLeftHandThumb1',
    LeftHandThumb2: 'mixamorigLeftHandThumb2',
    LeftHandThumb3: 'mixamorigLeftHandThumb3',
    LeftHandIndex1: 'mixamorigLeftHandIndex1',
    LeftHandIndex2: 'mixamorigLeftHandIndex2',
    LeftHandIndex3: 'mixamorigLeftHandIndex3',
    LeftHandMiddle1: 'mixamorigLeftHandMiddle1',
    LeftHandMiddle2: 'mixamorigLeftHandMiddle2',
    LeftHandMiddle3: 'mixamorigLeftHandMiddle3',
    LeftHandRing1: 'mixamorigLeftHandRing1',
    LeftHandRing2: 'mixamorigLeftHandRing2',
    LeftHandRing3: 'mixamorigLeftHandRing3',
    LeftHandPinky1: 'mixamorigLeftHandPinky1',
    LeftHandPinky2: 'mixamorigLeftHandPinky2',
    LeftHandPinky3: 'mixamorigLeftHandPinky3',

    // Right Hand Fingers (adjust names!)
    RightHandThumb1: 'mixamorigRightHandThumb1',
    RightHandThumb2: 'mixamorigRightHandThumb2',
    RightHandThumb3: 'mixamorigRightHandThumb3',
    RightHandIndex1: 'mixamorigRightHandIndex1',
    RightHandIndex2: 'mixamorigRightHandIndex2',
    RightHandIndex3: 'mixamorigRightHandIndex3',
    RightHandMiddle1: 'mixamorigRightHandMiddle1',
    RightHandMiddle2: 'mixamorigRightHandMiddle2',
    RightHandMiddle3: 'mixamorigRightHandMiddle3',
    RightHandRing1: 'mixamorigRightHandRing1',
    RightHandRing2: 'mixamorigRightHandRing2',
    RightHandRing3: 'mixamorigRightHandRing3',
    RightHandPinky1: 'mixamorigRightHandPinky1',
    RightHandPinky2: 'mixamorigRightHandPinky2',
    RightHandPinky3: 'mixamorigRightHandPinky3',
};

// MediaPipe Landmark Indices (for reference)
// Body (Pose) Landmarks: https://google.github.io/mediapipe/solutions/pose.html#pose-landmark-model-blazepose-ghump-3d
const POSE_LANDMARKS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7, RIGHT_EAR: 8,
    MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_PINKY: 17, RIGHT_PINKY: 18, // Pinky Knuckle
    LEFT_INDEX: 19, RIGHT_INDEX: 20, // Index Knuckle
    LEFT_THUMB: 21, RIGHT_THUMB: 22, // Thumb Knuckle
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
    LEFT_HEEL: 29, RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

// Hand Landmarks: https://google.github.io/mediapipe/solutions/hands.html#hand-landmarks
const HAND_LANDMARKS = {
    WRIST: 0,
    THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
    INDEX_FINGER_MCP: 5, INDEX_FINGER_PIP: 6, INDEX_FINGER_DIP: 7, INDEX_FINGER_TIP: 8,
    MIDDLE_FINGER_MCP: 9, MIDDLE_FINGER_PIP: 10, MIDDLE_FINGER_DIP: 11, MIDDLE_FINGER_TIP: 12,
    RING_FINGER_MCP: 13, RING_FINGER_PIP: 14, RING_FINGER_DIP: 15, RING_FINGER_TIP: 16,
    PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

// Helper to get a bone by mapped name
function getBone(name, bones) {
    const mappedName = BONE_MAPPING[name];
    return bones[mappedName];
}

// Helper to convert landmark coordinates to world space used by the model
function landmarkToWorld(landmark, THREE) {
    // Apply the same transformations as the stick figure:
    // Flip X, invert Y, scale, and apply model's offset and scale
    const x = -(landmark.x - 0.5) * landmarkScaleFactor;
    const y = -(landmark.y - 0.5) * landmarkScaleFactor - modelYOffset; // Adjust for model offset
    const z = landmark.z * landmarkScaleFactor;

    // Need to also account for the model's overall scale if we want world positions
    // For rotations, relative vectors are often sufficient, avoiding the need for full world coords
    return new THREE.Vector3(x, y, z);
}

// Helper function to calculate bone rotation based on two landmarks
// Aims the bone's Y-axis towards the target point. Adjust axis if model is different.
function lookAtTarget(bone, startLandmark, endLandmark, bones, THREE) {
    if (!bone || !startLandmark || !endLandmark) return;

    const startVec = landmarkToWorld(startLandmark, THREE);
    const endVec = landmarkToWorld(endLandmark, THREE);

    // Get the direction vector
    const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();

    // Avoid issues with zero vectors
    if (direction.lengthSq() < 0.0001) return;

    // --- Quaternion Method (More Robust) ---
    const targetQuaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0); // Assuming default up direction

    // Create a rotation matrix that looks towards the target
    const lookAtMatrix = new THREE.Matrix4();
    // Adjust the 'up' vector if needed, especially for limbs to avoid flipping
    // This part is tricky and model-dependent. We might need reference vectors.
    // For simplicity, using default up first.
    lookAtMatrix.lookAt(new THREE.Vector3(0,0,0), direction, up); // Look from origin towards direction

    targetQuaternion.setFromRotationMatrix(lookAtMatrix);

    // Apply the calculated rotation to the bone
    // We might need to combine this with the bone's default bind pose rotation
    // For now, directly setting quaternion. Might need .premultiply or .multiply depending on hierarchy.
    // Slerp for smoother transitions (optional but recommended)
     bone.quaternion.slerp(targetQuaternion, 0.5); // Adjust alpha (0.0 to 1.0) for smoothing

     // --- Alternative: Object3D.lookAt (Simpler but can have issues) ---
    // // Convert landmarks to world positions relative to the bone's parent
    // // This requires traversing up the hierarchy or using matrix transformations.
    // // For simplicity, we'll try using the raw world vectors calculated earlier,
    // // assuming the bone's parent transformations are handled correctly by Three.js.
    // const worldTarget = landmarkToWorld(endLandmark, THREE);
    // bone.lookAt(worldTarget);
    // // May need corrections based on the bone's default orientation
    // // bone.rotation.x += Math.PI / 2; // Example correction if bone points wrong way
}

// Main function to update the humanoid pose
export function updateHumanoidPose(results, bones, THREE) {
    if (!results || !bones || Object.keys(bones).length === 0) {
        // console.warn("Missing results or bones for humanoid update.");
        return;
    }

    const pose = results.poseLandmarks;
    const face = results.faceLandmarks;
    const leftHand = results.leftHandLandmarks;
    const rightHand = results.rightHandLandmarks;

    // --- 1. Update Body Position (Hips) ---
    const hipBone = getBone('Hips', bones);
    if (hipBone && pose && pose[POSE_LANDMARKS.LEFT_HIP] && pose[POSE_LANDMARKS.RIGHT_HIP]) {
        const leftHip = landmarkToWorld(pose[POSE_LANDMARKS.LEFT_HIP], THREE);
        const rightHip = landmarkToWorld(pose[POSE_LANDMARKS.RIGHT_HIP], THREE);
        const hipCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);

        // Apply position - might need adjustments based on model pivot
        hipBone.position.lerp(hipCenter, 0.5); // Lerp for smooth movement
    }

    // --- 2. Update Bone Rotations ---
    // Spine and Head
    lookAtTarget(getBone('Spine', bones), pose[POSE_LANDMARKS.LEFT_HIP], pose[POSE_LANDMARKS.LEFT_SHOULDER], bones, THREE); // Rough spine aim
    lookAtTarget(getBone('Neck', bones), pose[POSE_LANDMARKS.LEFT_SHOULDER], pose[POSE_LANDMARKS.NOSE], bones, THREE); // Rough neck aim
    lookAtTarget(getBone('Head', bones), pose[POSE_LANDMARKS.NOSE], pose[POSE_LANDMARKS.NOSE], bones, THREE); // Head might need face landmark orientation

    // Arms
    lookAtTarget(getBone('LeftArm', bones), pose[POSE_LANDMARKS.LEFT_SHOULDER], pose[POSE_LANDMARKS.LEFT_ELBOW], bones, THREE);
    lookAtTarget(getBone('LeftForeArm', bones), pose[POSE_LANDMARKS.LEFT_ELBOW], pose[POSE_LANDMARKS.LEFT_WRIST], bones, THREE);
    lookAtTarget(getBone('RightArm', bones), pose[POSE_LANDMARKS.RIGHT_SHOULDER], pose[POSE_LANDMARKS.RIGHT_ELBOW], bones, THREE);
    lookAtTarget(getBone('RightForeArm', bones), pose[POSE_LANDMARKS.RIGHT_ELBOW], pose[POSE_LANDMARKS.RIGHT_WRIST], bones, THREE);

    // Legs
    lookAtTarget(getBone('LeftUpLeg', bones), pose[POSE_LANDMARKS.LEFT_HIP], pose[POSE_LANDMARKS.LEFT_KNEE], bones, THREE);
    lookAtTarget(getBone('LeftLeg', bones), pose[POSE_LANDMARKS.LEFT_KNEE], pose[POSE_LANDMARKS.LEFT_ANKLE], bones, THREE);
    lookAtTarget(getBone('RightUpLeg', bones), pose[POSE_LANDMARKS.RIGHT_HIP], pose[POSE_LANDMARKS.RIGHT_KNEE], bones, THREE);
    lookAtTarget(getBone('RightLeg', bones), pose[POSE_LANDMARKS.RIGHT_KNEE], pose[POSE_LANDMARKS.RIGHT_ANKLE], bones, THREE);

    // Feet (optional)
    lookAtTarget(getBone('LeftFoot', bones), pose[POSE_LANDMARKS.LEFT_ANKLE], pose[POSE_LANDMARKS.LEFT_FOOT_INDEX], bones, THREE);
    lookAtTarget(getBone('RightFoot', bones), pose[POSE_LANDMARKS.RIGHT_ANKLE], pose[POSE_LANDMARKS.RIGHT_FOOT_INDEX], bones, THREE);


    // --- 3. Update Hands ---
    // Basic hand orientation (point hand bone towards middle finger MCP)
    if (leftHand) {
         lookAtTarget(getBone('LeftHand', bones), leftHand[HAND_LANDMARKS.WRIST], leftHand[HAND_LANDMARKS.MIDDLE_FINGER_MCP], bones, THREE);
         // Add finger updates here if desired (complex)
    }
     if (rightHand) {
         lookAtTarget(getBone('RightHand', bones), rightHand[HAND_LANDMARKS.WRIST], rightHand[HAND_LANDMARKS.MIDDLE_FINGER_MCP], bones, THREE);
         // Add finger updates here if desired (complex)
    }

    // --- 4. Update Face / Head ---
    // This is complex. Could involve:
    // - Rotating the Head bone based on face landmarks orientation (e.g., nose, ears).
    // - Using blend shapes (morph targets) on the model if available, driven by face landmarks.
    // Simple approach: Already rotated Head bone towards nose landmark. More refinement needed for tilt/nod.

}

// Function to hide the humanoid model
export function hideHumanoid(humanoidModel) {
    if (humanoidModel) {
        humanoidModel.visible = false;
    }
    // Optionally reset bone positions/rotations if needed when hiding
}
