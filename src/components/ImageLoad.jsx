import React, { useState, useRef } from 'react'

// The Hugging Face model ID for the skin cancer classification model
const MODEL_ID = 'Anwarkh1/Skin_Cancer-Image_Classification'

function ImageUploader() {
    const [selectedFile, setSelectedFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [processing, setProcessing] = useState(false)
    const [response, setResponse] = useState(null)
    const [error, setError] = useState(null)

    // Get your Hugging Face API token from environment variables
    const HF_TOKEN =
        import.meta.env.VITE_HUGGING_FACE_TOKEN || 'hf_YOUR_HUGGING_FACE_TOKEN'

    const imgInput = useRef(null)

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

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Please select an image first')
            return
        }

        setProcessing(true)
        setError(null)

        try {
            // Read the image file as a binary blob
            const arrayBuffer = await selectedFile.arrayBuffer()

            // Send the image directly as binary data
            const response = await fetch(
                `https://api-inference.huggingface.co/models/${MODEL_ID}`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${HF_TOKEN}`,
                        'Content-Type': 'application/octet-stream', // Send as binary data
                    },
                    body: arrayBuffer,
                }
            )

            // Check if the request was successful
            if (!response.ok) {
                let errorMessage = `HTTP error ${response.status}`
                try {
                    const errorData = await response.json()
                    errorMessage = `API Error: ${
                        response.status
                    } - ${JSON.stringify(errorData)}`
                } catch {
                    const errorText = await response.text()
                    errorMessage = `API Error: ${response.status} - ${errorText}`
                }
                throw new Error(errorMessage)
            }

            // Parse the response
            const result = await response.json()
            console.log('Classification result:', result)

            // Process the results based on the model's actual response format
            if (Array.isArray(result)) {
                // If result is an array of class predictions
                const processedResult = processClassificationResult(result)
                setResponse(processedResult)
            } else if (result.label) {
                // If result has a direct label
                setResponse({
                    message: 'Analysis complete',
                    label: result.label,
                    predicted_class_score: (result.score || 0).toFixed(4),
                    result: determineCancerStatus(result.label),
                })
            } else {
                // For any other response format
                console.log('Unknown response format:', result)
                setResponse({
                    message: 'Analysis complete (see console for details)',
                    rawResult: result,
                })
            }
        } catch (err) {
            console.error('Error processing image:', err)
            setError(`Error: ${err.message}`)
        } finally {
            setProcessing(false)
        }
    }

    // Helper function to process classification results
    const processClassificationResult = (results) => {
        // Sort by confidence score (descending)
        const sortedResults = [...results].sort((a, b) => b.score - a.score)
        const topResult = sortedResults[0]

        return {
            message: 'Analysis complete',
            label: topResult.label,
            predicted_class_score: topResult.score.toFixed(4),
            result: determineCancerStatus(topResult.label),
            allResults: sortedResults, // Store all results for reference
        }
    }

    // Helper function to determine cancer status from label
    const determineCancerStatus = (label) => {
        // This mapping depends on the specific labels used by the model
        const malignantLabels = [
            'malignant',
            'melanoma',
            'carcinoma',
            'basal cell carcinoma',
            'squamous cell carcinoma',
        ]

        // Check if any malignant terms appear in the label (case insensitive)
        const isMalignant = malignantLabels.some((term) =>
            label.toLowerCase().includes(term)
        )

        return isMalignant ? 'Cancer or Problematic' : 'Not Cancer'
    }

    return (
        <div className='w-75 sm:w-100 mx-auto p-6 bg-neutral-700 rounded-lg shadow-lg'>
            {processing && (
                <div className='mb-4 p-3 bg-neutral-600 text-white rounded'>
                    Analyzing image with Hugging Face API... This may take a
                    moment.
                </div>
            )}

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
                    className='w-full p-2 rounded text-black font-display bg-peach hover:bg-peach-light'
                >
                    {selectedFile
                        ? `IMAGE: ${selectedFile.name}`
                        : 'SELECT IMAGE'}
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
                disabled={!selectedFile || processing}
                className={`w-full p-2 rounded text-black font-display ${
                    !selectedFile || processing
                        ? 'bg-neutral-400'
                        : 'bg-peach hover:bg-peach-light'
                }`}
            >
                {processing ? 'ANALYZING...' : 'ANALYZE IMAGE'}
            </button>

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
                    {response.label && (
                        <span className='p-2'>
                            Type: {response.label}
                            <br />
                            Confidence:{' '}
                            {parseFloat(
                                (response.predicted_class_score * 100).toFixed(
                                    2
                                )
                            )}
                            %
                            <br />
                            Result: {response.result}
                        </span>
                    )}
                    {response.allResults && (
                        <div className='mt-2 p-2'>
                            <h4 className='font-bold mb-1'>
                                All Classifications:
                            </h4>
                            <ul className='text-sm'>
                                {response.allResults.map((result, index) => (
                                    <li key={index}>
                                        {result.label}:{' '}
                                        {(result.score * 100).toFixed(2)}%
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {response.rawResult && (
                        <pre className='p-2 text-xs overflow-auto'>
                            {JSON.stringify(response.rawResult, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    )
}

export default ImageUploader
