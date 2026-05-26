  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

  const wrap = document.getElementById('camera3d-wrap');
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('camera3d').appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const blueNeonRim = new THREE.DirectionalLight(0x3b82f6, 4.5);
  blueNeonRim.position.set(6, 4, 2);
  scene.add(blueNeonRim);

  const keyFill = new THREE.DirectionalLight(0xffffff, 2.0);
  keyFill.position.set(-5, 6, 4);
  scene.add(keyFill);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  let modelGroup = null;

  loader.load(
    './negrsense-v1.glb',
    function (gltf) {
      const object = gltf.scene;

      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();

      box.getSize(size);
      box.getCenter(center);

      const wrapper = new THREE.Group();
      object.position.x = -center.x;
      object.position.y = -center.y;
      object.position.z = -center.z;
      wrapper.add(object);
      object.traverse((child) => {
          if (child.isMesh) {        
            child.material = new THREE.MeshStandardMaterial({
              color: 0x121212,
              metalness: 0.8,
              roughness: 0.35
            });        
          }      
        });

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? 2.4 / maxDim : 1;
      wrapper.scale.setScalar(scale);

      scene.add(wrapper);
      modelGroup = wrapper;

      document.getElementById('camera-loader').style.opacity = '0';
    },
    function (xhr) {
      if (xhr.total) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        document.querySelector('.loader-percent').innerText = percent + '%';
      }
    },
    function (error) {
      console.error('Error loading GLB:', error);
    }
  );

  function animate() {
    requestAnimationFrame(animate);

    if (modelGroup) {
      modelGroup.rotation.y += 0.003;
    }

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });