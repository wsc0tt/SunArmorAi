import React, { useState, useRef } from 'react'
import * as ort from 'onnxruntime-web'

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'

function ImageUploader() {
    const [selectedFile, setSelectedFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [response, setResponse] = useState(null)
    const [error, setError] = useState(null)

    const imgInput = useRef(null)
    // new
    const canvasRef = useRef(null)

    // Replace with your ngrok URL from Colab
    //const API_URL = 'https://bcfb-130-86-97-245.ngrok-free.app/upload'

    const handleFileChange = (event) => {
        const file = event.target.files[0]

        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file')
                return
            }
            if (file.size > 5 * 1024 * 1024) {
                // 5MB limit
                setError('File size exceeds 5MB')
                return
            }

            setSelectedFile(file)

            // Create preview
            const reader = new FileReader()
            reader.onloadend = () => {
                setPreview(reader.result)
            }
            reader.readAsDataURL(file)

            // Reset states
            setResponse(null)
            setError(null)
        }
    }

    // *** new ***
    const preprocessImage = (img, width = 224, height = 224) => {
        const canvas = canvasRef.current
        if (!canvas) {
            throw new Error('Canvas element is not available')
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, width, height).data
        const inputData = new Float32Array(width * height * 3)

        // normalize rgb values
        for (let i = 0; i < imageData.length / 4; i++) {
            inputData[i * 3] = imageData[i * 4] / 255
            inputData[i * 3 + 1] = imageData[i * 4 + 1] / 255
            inputData[i * 3 + 2] = imageData[i * 4 + 2] / 255
        }

        // shape
        return new ort.Tensor('float32', inputData, [1, 3, height, width])
    }

    const softmax = (arr) => {
        const exp = arr.map(Math.exp)
        const sumExp = exp.reduce((a, b) => a + b, 0)
        return exp.map((x) => x / sumExp)
    }

    const handleUpload = async () => {
        let isMounted = true
        if (!selectedFile) {
            setError('Please select an image first')
            return
        }

        setUploading(true)
        setError(null)

        try {
            // Load the ONNX model from the public folder
            const session = await ort.InferenceSession.create('/model.onnx')
            console.log('Model output names:', session.outputNames) // Debug output names
            // Preprocess the image
            const img = new Image()
            img.src = preview
            await new Promise((resolve) => (img.onload = resolve))

            if (!canvasRef.current) {
                throw new Error('Canvas element is not available')
            }

            const tensor = preprocessImage(img)

            // Run inference
            const feeds = { pixel_values: tensor } // Replace 'input' with your model's input name
            const results = await session.run(feeds)
            console.log('Results:', Object.keys(results)) // Debug results
            // Process output (replace 'output' with your model's output name)
            const logits = results.logits.data
            const predictedClassIdx = Array.from(logits).reduce(
                (maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
                0
            )
            const probabilities = softmax(Array.from(logits))
            const predictedClassScore =
                probabilities[predictedClassIdx].toFixed(4)

            const id2label = {
                0: 'Benign',
                1: 'Malignant',
                2: 'Malignant',
                3: 'Malignant',
                4: 'Benign',
                5: 'Malignant',
                6: 'Benign',
            }
            const label = id2label[predictedClassIdx]

            let result
            if ([0, 4, 6].includes(predictedClassIdx)) {
                result = 'Not Cancer'
            } else if ([1, 2, 3, 5].includes(predictedClassIdx)) {
                result = 'Cancer or Problematic'
            } else {
                result = predictedClassScore < 0.5 ? 'Unknown' : 'Unclassified'
            }
            if (isMounted) {
                setResponse({
                    message: 'Inference complete.',
                    label: label,
                    predicted_class_score: predictedClassScore,
                    result: result,
                })
            }
        } catch (err) {
            if (isMounted) setError(err.message || 'Error processing image')
            console.error('Inference error:', err)
        } finally {
            if (isMounted) setUploading(false)
        }
    }

    return (
        <div className='w-75 sm:w-100 mx-auto p-6 bg-neutral-700 rounded-lg shadow-lg'>
            <div className='mb-4'>
                <input
                    type='file'
                    accept='image/*'
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    ref={imgInput}
                />
                <button
                    onClick={() => imgInput.current.click()}
                    className='w-full p-2 rounded text-black bg-peach hover:bg-peach-light font-display'
                >
                    SELECT IMAGE
                </button>
            </div>

            {preview && (
                <div className='mb-4 flex flex-col items-center'>
                    <img
                        src={preview}
                        alt='Preview'
                        className='max-h-64 max-w-full rounded'
                    />
                </div>
            )}

            <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className={`w-full p-2 rounded text-black font-display ${
                    !selectedFile || uploading
                        ? 'bg-neutral-400'
                        : 'bg-peach hover:bg-peach-light'
                }`}
            >
                {uploading ? 'UPLOADING...' : 'UPLOAD'}
            </button>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {error && (
                <div className='mt-4 p-3 bg-neutral-300 text-red-500 rounded font-display'>
                    ERROR: {error}
                </div>
            )}
            {response && (
                <div className='flex flex-col mt-4 p-3 bg-neutral-300 text-black rounded font-display'>
                    <span className='bg-peach-light p-2 rounded animate-pulse'>
                        Success! {response.message}
                    </span>
                    <span className='p-2'>
                        Type: {response.label}
                        <br />
                        Confidence:{' '}
                        {parseFloat(
                            (response.predicted_class_score * 100).toFixed(2)
                        )}
                        %
                        <br />
                        Result: {response.result}
                    </span>
                </div>
            )}
        </div>
    )
}

export default ImageUploader
