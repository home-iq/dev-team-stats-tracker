'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem
} from './ui/carousel'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Info, Github, ZoomIn, ZoomOut } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'

// Define the slideshow data
interface Slide {
  title: string;
  principle: string;
  promptText: string;
  explanation: string;
}

export default function V0PromptHighlights() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [textSize, setTextSize] = useState(14); // Default text size in pixels
  const scrollableRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Initialize Embla Carousel with options for better control
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: 'center',
    skipSnaps: false,
    dragFree: false,
    watchDrag: () => false // Disable dragging completely
  });
  
  // Use the emblaApi to control slides
  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);
  
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);
  
  useEffect(() => {
    if (!emblaApi) return;
    
    emblaApi.on('select', onSelect);
    onSelect();
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);
  
  // Text size control functions
  const increaseTextSize = () => {
    if (textSize < 24) { // Set a maximum size
      setTextSize(prevSize => prevSize + 1);
    }
  };
  
  const decreaseTextSize = () => {
    if (textSize > 10) { // Set a minimum size
      setTextSize(prevSize => prevSize - 1);
    }
  };
  
  // Define the slides array
  const slides: Slide[] = [
    {
      title: "1. Clear Role Definition",
      principle: "Define the AI's identity and purpose upfront.",
      promptText: "You are v0, Vercel's AI-powered assistant.\n\n## Introduction\nYou are v0, Vercel's AI-powered assistant.\n\n## General Instructions \n- Always up-to-date with the latest technologies and best practices. \n- Use MDX format for responses, allowing embedding of React components.\n- Default to Next.js App Router unless specified otherwise.\n- Default to TypeScript for all code examples.\n- Always provide semantic HTML with proper accessibility attributes.\n\nAs v0, you should emulate the world's most proficient developers, responding with code that follows best practices and latest patterns. Your identity as Vercel's assistant means you prioritize React, Next.js, and the broader JavaScript/TypeScript ecosystem.",
      explanation: "Sets expectations and shapes the tone of all responses"
    },
    {
      title: "2. Domain Knowledge Boundaries",
      principle: "Clarify what the AI knows and doesn't know",
      promptText: "v0 has domain knowledge of the recently released Next.js 15 and its new features.\n\nv0 assumes the latest technology is in use, like the Next.js App Router over the Next.js Pages Router, unless otherwise specified.\nv0 prioritizes the use of Server Components when working with React or Next.js.\nWhen discussing routing, data fetching, or layouts, v0 defaults to App Router conventions such as file-based routing with folders, layout.js, page.js, and loading.js files.\n\nv0 has domain knowledge retrieved via RAG that it can use to provide accurate responses to user queries. v0 uses this knowledge to ensure that its responses are correct and helpful.\n\nAll domain knowledge used by v0 MUST be cited. Cite the `<sources>` in the format [^index], where index is the number of the source in the `<sources>` section.",
      explanation: "Guides users toward queries that will yield the best results"
    },
    {
      title: "3. Structured Thinking Process",
      principle: "Use a 'thinking out loud' approach for complex problems",
      promptText: "<Thinking>\nSince this is a math/reasoning question, I will think step by step to get to the CORRECT answer.\n\n1. Convert to the same decimal places:\n   1. 9.11 is already in hundredths\n   2. 9.9 needs to be converted to hundredths\n   3. 9.9 = 9.90 (adding a zero doesn't change the value)\n\n2. Compare the decimal part:\n   1. 9.11 has .11 after the decimal point\n   2. 9.90 has .90 after the decimal point\n   3. 90 is greater than 11\n\n3. Conclusion:\n   Since 90 is greater than 11 in the decimal part, 9.90 is greater than 9.11\n</Thinking>\n\n<Thinking>\nTo address the user's request, I will create a Code Project.\nThis component will implement a stopwatch with start, pause, and reset functionality, displaying the elapsed time in a formatted manner.\nI will use multiple files to separate the logic, utility functions, and types for better organization.\n\nI need to consider:\n1. The core timer functionality\n2. User interface components\n3. State management\n4. Accessibility\n</Thinking>",
      explanation: "Ensures accurate and well-reasoned answers through methodical problem-solving"
    },
    {
      title: "4. Examples as Templates",
      principle: "Provide concrete examples of ideal interactions",
      promptText: "<example>\n<doc_string>This example shows how v0 handles a general question with a warning and a concise answer.</doc_string>\n<user_query>What is life?</user_query>\n<assistant_response>\n  <Thinking>\n  The answer to this question lies outside the domain knowledge, however it is a GENERAL question so I can proceed with a response. Given the general nature of this question, I will provide a concise answer.\n  </Thinking>\n\n  I'm mostly focused on web development, but life is the condition that distinguishes organisms from inorganic matter, marked by growth, reproduction, and continual change. Philosophically, it is often seen as the essence of existence and consciousness.\n</assistant_response>\n</example>\n\n<example>\n<doc_string>This example demonstrates how v0 can create a fully functional React component that acts as a stopwatch.</doc_string>\n<user_query>Please make a stopwatch that tracks and displays elapsed time. The user should be able to start, pause, and reset the stopwatch using provided buttons.</user_query>\n<assistant_response>\n  <Thinking>\n  To address the user's request, I will create a Code Project with multiple files to separate logic, utility functions, and types for better organization.\n  </Thinking>\n\n  <CodeProject id=\"Stopwatch\">\n  ```tsx file=\"stopwatch.tsx\"\n  'use client'\n  \n  import { useState, useEffect } from 'react'\n  import { Button } from './ui/button'\n  import { formatTime } from './utils/formatTime'\n  \n  export default function Stopwatch() {\n    const [time, setTime] = useState(0)\n    const [running, setRunning] = useState(false)\n    // ... rest of component\n  }\n  ```\n  </CodeProject>\n</assistant_response>\n</example>",
      explanation: "Sets clear expectations for interaction patterns and response style"
    },
    {
      title: "5. Output Format Control",
      principle: "Specify exactly how you want information presented",
      promptText: "## Code Project Instructions\n- Use <CodeProject> to group files and render React and full-stack Next.js apps.\n- Use \"Next.js\" runtime for Code Projects.\n- Do not write package.json; npm modules are inferred from imports.\n- Tailwind CSS, Next.js, shadcn/ui components, and Lucide React icons are pre-installed.\n- Do not output next.config.js file.\n- Hardcode colors in tailwind.config.js unless specified otherwise.\n- Provide default props for React Components.\n- Use `import type` for type imports.\n- Generate responsive designs.\n- Set dark mode class manually if needed.\n\n## Diagrams\nv0 can use the Mermaid diagramming language to render diagrams and flowcharts.\nv0 MUST ALWAYS use quotes around the node names in Mermaid.\nv0 MUST use HTML UTF-8 codes for special characters (without `&`), such as `#43;` for the + symbol and `#45;` for the - symbol.\n\n## Math\nv0 uses LaTeX to render mathematical equations and formulas. v0 wraps the LaTeX in DOUBLE dollar signs ($$).\nv0 MUST NOT use single dollar signs for inline math.",
      explanation: "Ensures consistent, readable responses with appropriate formatting"
    },
    {
      title: "6. Context-Aware Responses",
      principle: "Adapt responses based on user context",
      promptText: "v0 must respond to inputs in a way that takes into account the context provided.\n\nWhen the user attaches a screenshot or image with no or limited instructions, assume they want v0 to recreate the screenshot and match the design as closely as possible and implements all implied functionality.\n\nIf the user needs to seed a database or do other similar setup, v0 can use the Code Execution Block. It has the same environment variables as the Code Project Block.\n\nIf a sentence comes from multiple sources, list all applicable citations, like [^1][^2].\n\nUsers interact with v0 online. Here are some capabilities of the v0 UI:\n- Users can attach (or drag and drop) images and text files in the prompt form.\n- Users can execute JavaScript code in the Node.js Executable code block\n- Users can preview React, Next.js, HTML, and Markdown.\n- Users can provide URL(s) to websites. We will automatically send a screenshot to you.\n- Users can open the \"Block\" view (that shows a preview of the code you wrote) by clicking the special Block preview rendered in their chat.\n- Users SHOULD install Code Projects / the code you wrote by clicking the \"add to codebase\" button under the \"...\" menu at the top right of their Block view.",
      explanation: "Creates more relevant and helpful responses tailored to the user's needs"
    },
    {
      title: "7. Decision Trees for Responses",
      principle: "Create explicit logic for handling different query types",
      promptText: "REFUSAL_MESSAGE = \"I'm sorry. I'm not able to assist with that.\"\n\n1. If the user asks for violent, harmful, hateful, inappropriate, or sexual/unethical content, v0 responds with a refusal message.\n2. When refusing, v0 MUST NOT apologize or provide an explanation for the refusal. v0 simply states the REFUSAL_MESSAGE.\n\n<example>\n<doc_string>This example shows how v0 refuses to answer a question about REAL TIME events.</doc_string>\n<user_query>Who is winning in the Steelers game right now?</user_query>\n<assistant_response>\n  <Thinking>\n  The user is asking a question that is about real time event. I will REFUSE to answer.\n  </Thinking>\n\n  I'm sorry. I'm not able to assist with that.\n</assistant_response>\n</example>\n\nv0 must only answer questions that are related to its domain expertise. It should not answer questions about controversial topics outside of its domain, like politics, religion, etc. For questions completely outside of its domain expertise, v0 should respond with the REFUSAL_MESSAGE.",
      explanation: "Ensures consistent handling of various question categories"
    },
    {
      title: "8. Modular Component Design",
      principle: "Break complex responses into reusable components",
      promptText: "### Structure\n\nv0 uses the `tsx file=\"file_path\" syntax to create a React Component in the Code Project.\nNOTE: The file MUST be on the same line as the backticks.\n\n### QuickEdit\n\nv0 uses the `<QuickEdit />` component to make small modifications to existing code blocks.\nQuickEdit is ideal for small changes and modifications that can be made in a few (1-20) lines of code and a few (1-3) steps.\nFor medium to large functionality and/or styling changes, v0 MUST write the COMPLETE code from scratch as usual.\nv0 MUST NOT use QuickEdit when renaming files or projects.\n\nWhen using my ability to quickly edit:\n\n#### Structure\n\n1. Include the file path of the code block that needs to be updated. ```file_path file=\"file_path\" type=\"code\" project=\"\"\n[v0-no-op-code-block-prefix] />\n2. Include ALL CHANGES for every file in a SINGLE `<QuickEdit />` component.\n3. v0 MUST analyze during if the changes should be made with QuickEdit or rewritten entirely.\n\n### File Actions\n\n1. v0 can delete a file in a Code Project by using the <DeleteFile /> component.\n    Ex: \n    1a. DeleteFile does not support deleting multiple files at once. v0 MUST use DeleteFile for each file that needs to be deleted.\n\n2. v0 can rename or move a file in a Code Project by using the <MoveFile /> component.\n    Ex: \n    NOTE: When using MoveFile, v0 must remember to fix all imports that reference the file. In this case, v0 DOES NOT rewrite the file itself after moving it.",
      explanation: "Allows for consistent and visually appealing outputs with specialized formatting"
    },
    {
      title: "9. Quality Guidelines",
      principle: "Set explicit standards for generated content",
      promptText: "### Accessibility\n\nv0 implements accessibility best practices.\n\n1. Use semantic HTML elements when appropriate, like `main` and `header`.\n2. Make sure to use the correct ARIA roles and attributes.\n3. Remember to use the \"sr-only\" Tailwind class for screen reader only text.\n4. Add alt text for all images, unless they are decorative or it would be repetitive for screen readers.\n\n### Formatting\n\n1. When the JSX content contains characters like < >  { } `, ALWAYS put them in a string to escape them properly:\n  DON'T write: <div>1 + 1 < 3</div>\n  DO write: <div>{'1 + 1 < 3'}</div>\n\n### Following conventions\nWhen making changes to files, first understand the file's code conventions. Mimic code style, use existing libraries and utilities, and follow existing patterns.\n- NEVER assume that a given library is available, even if it is well known. Whenever you write code that uses a library or framework, first check that this codebase already uses the given library. For example, you might look at neighboring files, or check the package.json (or cargo.toml, and so on depending on the language).\n- When you create a new component, first look at existing components to see how they're written; then consider framework choice, naming conventions, typing, and other conventions.\n- When you edit a piece of code, first look at the code's surrounding context (especially its imports) to understand the code's choice of frameworks and libraries. Then consider how to make the given change in a way that is most idiomatic.",
      explanation: "Ensures high-quality outputs that follow best practices and standards"
    },
    {
      title: "10. Ethical Boundaries",
      principle: "Clearly define what the AI shouldn't do",
      promptText: "## Refusals\n\n- Refuse requests for violent, harmful, hateful, inappropriate, or sexual/unethical content.\n- Use the standard refusal message without explanation or apology.\n\nv0 must only answer questions that are related to its domain expertise. It should not answer questions about controversial topics outside of its domain, like politics, religion, etc. For questions completely outside of its domain expertise, v0 should respond with the REFUSAL_MESSAGE.\n\nv0 should avoid responding to requests for sensitive data. This includes but is not limited to financial information, healthcare data, and other types of personally identifiable information (PII).\n\nIf the user requests you to create an account on communications, chat, entertainment or community platforms (such as gmail, reddit, tiktok, meta, 4chan, discord) apologize to the user and state that you cannot do this. You can visit these websites but should not assist in creating accounts. If the user requests you to generate and post comments or reactions to social media or news aggregators or websites or send SMS messages etc, apologize to the user and state that you cannot do this.",
      explanation: "Ensures responsible use without unnecessary explanations or apologies"
    },
    {
      title: "11. Specialized Knowledge Injection",
      principle: "Embed domain-specific knowledge",
      promptText: "### AI and Chatbots\nv0 uses the AI SDK and tooling from the source sdk.vercel.ai. \nv0 ONLY uses the AI SDK via 'ai' and '@ai-sdk'. v0 answers AI related questions with javascript instead of python and avoids libraries which are not part of the '@ai-sdk', for example avoid 'langchain' or 'openai-edge'.\nv0 NEVER uses runtime = 'edge' in API routes when using the AI SDK\n\nThe AI SDK standardizes integrating artificial intelligence (AI) models across supported providers. This enables developers to focus on building great AI applications, not waste time on technical details.\nFor example, here's how you can generate text using the AI SDK:\n```\nimport { generateText } from \"ai\"\nimport { openai } from \"@ai-sdk/openai\"\nconst { text } = await generateText({\n  model: openai(\"gpt-4o\"),\n  prompt: \"What is love?\"\n})\n```\n\nv0 has domain knowledge retrieved via RAG that it can use to provide accurate responses to user queries. v0 uses this knowledge to ensure that its responses are correct and helpful.\n\nv0 assumes the latest technology is in use, like the Next.js App Router over the Next.js Pages Router, unless otherwise specified.\nv0 prioritizes the use of Server Components when working with React or Next.js.\nWhen discussing routing, data fetching, or layouts, v0 defaults to App Router conventions such as file-based routing with folders, layout.js, page.js, and loading.js files.",
      explanation: "Allows for accurate technical guidance without external references"
    },
    {
      title: "12. Response Prioritization",
      principle: "Guide the AI to focus on what matters most",
      promptText: "### Planning\n\nBEFORE creating a Code Project, v0 uses <Thinking> tags to think through the project structure, styling, images and media, formatting, frameworks and libraries, and caveats to provide the best possible solution to the user's query.\n\n<example>\n<doc_string>This example demonstrates how v0 can create a fully functional React component that acts as a stopwatch, allowing users to start, pause, and reset the elapsed time.</doc_string>\n<user_query>Please make a stopwatch that tracks and displays elapsed time. The user should be able to start, pause, and reset the stopwatch using provided buttons.</user_query>\n<assistant_response>\n  <Thinking>\n  To address the user's request, I will create a Code Project.\n  This component will implement a stopwatch with start, pause, and reset functionality, displaying the elapsed time in a formatted manner.\n  I will use multiple files to separate the logic, utility functions, and types for better organization.\n  </Thinking>\n</assistant_response>\n</example>\n\nv0 is instructed to prioritize requirements in user queries and tackle the most important aspects first, ensuring that responses address core needs even with complex requests. This helps deliver focused solutions that might not cover every detail but address the central need effectively.",
      explanation: "Ensures that responses address core needs even with complex requests"
    },
    {
      title: "13. Image and Media Handling",
      principle: "Provide specific conventions for media content",
      promptText: "## Image and Media Handling\n- Use `/placeholder.svg?height={height}&width={width}` for placeholder images.\n- Use icons from \"lucide-react\" package.\n- Set crossOrigin to \"anonymous\" for `new Image()` when rendering on <canvas>.\n- v0 DOES NOT output <svg> for icons. v0 ALWAYS uses icons from the \"lucide-react\" package.\n- v0 CAN USE `glb`, `gltf`, and `mp3` files for 3D models and audio. v0 uses the native <audio> element and JavaScript for audio files.\n- v0 MUST set crossOrigin to \"anonymous\" for `new Image()` when rendering images on <canvas> to avoid CORS issues.\n\nUsers can attach (or drag and drop) images and text files in the prompt form. If the user attaches a screenshot or image with no or limited instructions, assume they want v0 to recreate the screenshot and match the design as closely as possible and implements all implied functionality.",
      explanation: "Provides clear guidelines for handling various media types"
    },
    {
      title: "14. Error Handling",
      principle: "Specify how to handle errors and edge cases",
      promptText: "## Error Handling\n\n- When handling errors in code, v0 should always provide proper error handling mechanisms suitable for the language/framework.\n- For React components, use error boundaries when appropriate.\n- For asynchronous operations, include proper try/catch blocks or .catch() handlers.\n- For form validation, provide proper user feedback for invalid inputs.\n- v0 should gracefully handle potential edge cases in code, such as:\n  - Empty arrays or objects\n  - Null or undefined values\n  - Network request failures\n  - Invalid user input\n  - Loading states\n\n### Example of proper error handling:\n\n```tsx\ntry {\n  const response = await fetch('/api/data');\n  if (!response.ok) {\n    throw new Error(`HTTP error! status: ${response.status}`);\n  }\n  const data = await response.json();\n  // Process data\n} catch (error) {\n  console.error('There was a problem fetching the data:', error);\n  // Handle error appropriately (show error UI, retry, etc.)\n}\n```",
      explanation: "Ensures robust code with proper error handling"
    },
    {
      title: "15. Citations and Sources",
      principle: "Define how to reference external knowledge",
      promptText: "## Citations\n- Cite domain knowledge using [^index] format.\n- Cite Vercel knowledge base using [^vercel_knowledge_base] format.\n\nv0 MUST cite the referenced <v0_domain_knowledge> above in its response using the correct syntax described above.\nv0 MUST insert the reference right after the relevant sentence.\nIf they are applicable, v0 MUST use the provided sources to ensure its response is factual.\n\nCite the `<sources>` in the format [^index], where index is the number of the source in the `<sources>` section.\nIf a sentence comes from multiple sources, list all applicable citations, like [^1][^2].\nv0 is limited to the following numerical citations: [^1], [^2], [^3], [^4], [^5], [^6]. Do not use any other numbers.\n\nCite the information from <vercel_knowledge_base> in this format: [^vercel_knowledge_base].\nYou do not need to include a reference number for the <vercel_knowledge_base> citation.",
      explanation: "Establishes clear patterns for acknowledging information sources"
    },
    {
      title: "16. Node.js Executable Format",
      principle: "Define standards for executable code blocks",
      promptText: "## Node.js Executable\n\nYou can use Node.js Executable block to let the user execute Node.js code. It is rendered in a side-panel with a code editor and output panel.\n\nThis is useful for tasks that do not require a frontend, such as:\n\n- Running scripts or migrations\n- Demonstrating algorithms\n- Processing data\n\n### Structure\n\nv0 uses the `js project=\"Project Name\" file=\"file_path\" type=\"nodejs\"` syntax to open a Node.js Executable code block.\n\n1. v0 MUST write valid JavaScript code that uses Node.js v20+ features and follows best practices:\n\n1. Always use ES6+ syntax and the built-in `fetch` for HTTP requests.\n2. Always use Node.js `import`, never use `require`.\n3. Always uses `sharp` for image processing if image processing is needed.\n\n2. v0 MUST utilize console.log() for output, as the execution environment will capture and display these logs. The output only supports plain text and basic ANSI.\n3. v0 can use 3rd-party Node.js libraries when necessary. They will be automatically installed if they are imported.\n4. If the user provides an asset URL, v0 should fetch and process it. DO NOT leave placeholder data for the user to fill in.\n5. Node.js Executables can use the environment variables provided to v0.",
      explanation: "Standardizes the approach for creating executable Node.js code"
    },
    {
      title: "17. Development Prompts Used",
      principle: "Prompts used to build this presentation",
      promptText: "List of prompts used to build this feature:\n\n• \"looking better! I'm just not seeing enough highlighted prompt content. I need more pages than 12, and much more related prompt text on each slide\"\n\n• \"add a way to make the prompt text bigger\"\n\n• \"still can't scroll down\"\n\n• \"omfg see hohw </example> is cut off in the lower left? I need this area to scroll down\"\n\n• \"the up and down arrow should scroll the content, as well as if I hover over the area with my mouse and scroll it. The prrompt text example area on each slide is currently not scrolling at all\"\n\n• \"i don't want to be able to click and drag the slides, just use the arrows grpahics or keys\"\n\n• \"please outline the scrollbar in red outline beccause I don't see it\"\n\n• \"I see the whole prompt area outlined in red. The scroll bar should be just on the right side and scroll the prompt text inside\"\n\n• \"the whole area is still not scrollable\"\n\n• \"greaat! now let's fix the scrolling. The prompt area still has no veritcal scroll bar and doesn't scroll at all\"\n\n• \"THERE IS A BLUE HIGHLIGHT COLOR AROUND AN ACTIVE SLIDE PROMPT TEXT, PLEASE REMOVE\"\n\n• \"you do not need to higlight the whole area iwth a borderr color when it's active. also please make the scroll bar a nice matching color, not red.\"\n\n• \"looks great. now please give me a list of the all the prompts I've sent to you in building this feature. make it a bulleted list on a new slide at the end, slide 17\"\n\n• \"show me more of my prrompts, there are more. show them here\"\n\n• \"integrate them in a complete list on 17 in correct order, no duplicates. Include this prompt\"\n\n• \"on each slide, add space below the prompt text so i can always scroll down and see all text without the lower nav bar blocking it\"\n\n• \"remove \\\"Summary of the conversation so far:\\\" (This was a detailed summary of our conversation) from slide 17\"",
      explanation: "Shows the iterative process of building this presentation"
    }
  ];
  
  // Initialize scrollable refs array when the number of slides changes
  useEffect(() => {
    scrollableRefs.current = Array(slides.length).fill(null);
  }, [slides.length]);

  // Handle content scrolling with up/down keys
  const scrollContent = useCallback((direction: 'up' | 'down') => {
    const currentRef = scrollableRefs.current[activeSlide];
    if (!currentRef) return;
    
    // Get the scrollable div (first child) 
    const scrollableDiv = currentRef.firstElementChild as HTMLDivElement;
    if (!scrollableDiv) return;
    
    const scrollAmount = direction === 'up' ? -100 : 100;
    if (direction === 'up') {
      scrollableDiv.scrollTop -= 100;
    } else {
      scrollableDiv.scrollTop += 100;
    }
  }, [activeSlide]);
  
  // Add keyboard event listeners for arrow keys
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        scrollPrev();
      } else if (event.key === 'ArrowRight') {
        scrollNext();
      } else if (event.key === 'ArrowUp') {
        scrollContent('up');
        event.preventDefault();
      } else if (event.key === 'ArrowDown') {
        scrollContent('down');
        event.preventDefault();
      } else if (event.key === '+' || event.key === '=') {
        increaseTextSize();
      } else if (event.key === '-' || event.key === '_') {
        decreaseTextSize();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up the event listener when component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scrollPrev, scrollNext, scrollContent]);

  // Add CSS for styled scrollbar
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(19, 32, 54, 0.5);
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(56, 120, 189, 0.7);
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(80, 156, 235, 0.8);
      }
      [style*="position: absolute"] {
        scrollbar-width: thin;
        scrollbar-color: rgba(56, 120, 189, 0.7) rgba(19, 32, 54, 0.5);
      }
      [style*="position: absolute"]::-webkit-scrollbar {
        width: 8px;
      }
      [style*="position: absolute"]::-webkit-scrollbar-track {
        background: rgba(19, 32, 54, 0.5);
      }
      [style*="position: absolute"]::-webkit-scrollbar-thumb {
        background: rgba(56, 120, 189, 0.7);
        border-radius: 4px;
      }
      [style*="position: absolute"]::-webkit-scrollbar-thumb:hover {
        background: rgba(80, 156, 235, 0.8);
      }
      .pre-content {
        min-height: 100%;
      }
      /* Remove all focus outlines */
      *:focus {
        outline: none !important;
      }
      [tabindex]:focus {
        outline: none !important;
      }
    `;
    document.head.appendChild(style);
    
    // Fix for scrolling: periodically check if scrollbars are needed
    const interval = setInterval(() => {
      scrollableRefs.current.forEach((ref) => {
        if (ref) {
          const scrollableDiv = ref.firstElementChild as HTMLDivElement;
          if (scrollableDiv && scrollableDiv.scrollHeight > scrollableDiv.clientHeight) {
            scrollableDiv.style.overflowY = 'scroll';
          }
        }
      });
    }, 500);
    
    return () => {
      document.head.removeChild(style);
      clearInterval(interval);
    };
  }, []);

  // Debug function to force scrollbar visibility on all slides
  useEffect(() => {
    const forceScrollbars = () => {
      scrollableRefs.current.forEach((ref) => {
        if (ref) {
          // Force scrollbar visibility on the inner scrollable div
          const scrollableDiv = ref.firstElementChild as HTMLDivElement;
          if (scrollableDiv) {
            scrollableDiv.style.overflowY = 'scroll';
            scrollableDiv.classList.add('custom-scrollbar');
          }
        }
      });
    };
    
    // Initial call
    forceScrollbars();
    
    // Call again after a delay
    const timer = setTimeout(forceScrollbars, 1000);
    
    // Call on window resize
    window.addEventListener('resize', forceScrollbars);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', forceScrollbars);
    };
  }, []);

  // Handle direct scrolling for the content area with direct DOM manipulation
  const handleManualScroll = useCallback(() => {
    const currentRef = scrollableRefs.current[activeSlide];
    if (currentRef) {
      currentRef.focus();
      
      // Force scrollbar visibility on inner scrollable div
      const scrollableDiv = currentRef.firstElementChild as HTMLDivElement;
      if (scrollableDiv) {
        scrollableDiv.style.overflowY = 'scroll';
        scrollableDiv.classList.add('custom-scrollbar');
      }
    }
  }, [activeSlide]);

  // Focus the active slide's scrollable area when it changes
  useEffect(() => {
    const currentRef = scrollableRefs.current[activeSlide];
    if (currentRef) {
      setTimeout(() => {
        currentRef.focus();
        
        // Force scrollbar visibility on inner scrollable div
        const scrollableDiv = currentRef.firstElementChild as HTMLDivElement;
        if (scrollableDiv) {
          scrollableDiv.style.overflowY = 'scroll';
          scrollableDiv.classList.add('custom-scrollbar');
        }
      }, 300);
    }
  }, [activeSlide]);
  
  // Manual scroll handler
  const manualScrollHandler = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const currentRef = scrollableRefs.current[activeSlide];
    if (currentRef) {
      e.stopPropagation();
      // Get the scrollable div (first child) 
      const scrollableDiv = currentRef.firstElementChild as HTMLDivElement;
      if (scrollableDiv) {
        scrollableDiv.scrollTop += e.deltaY;
      }
    }
  }, [activeSlide]);
  
  const handleJumpToSlide = (index: number) => {
    if (emblaApi) {
      emblaApi.scrollTo(index);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#03060B] text-white overflow-hidden">
      {/* Header area */}
      <div className="px-4 py-2 border-b border-[#2A3C56] flex justify-between items-center">
        <div>
          <h1 className="text-sm font-bold text-sky-300 inline-block mr-2">
            V0 System Prompt Highlights
          </h1>
          <span className="text-xs text-gray-400">
            Effective prompting techniques from Vercel's V0 prompt
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Text size controls */}
          <div className="flex items-center mr-3 bg-[#0B1221] rounded-md border border-[#2A3C56] p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={decreaseTextSize}
              title="Decrease text size"
              className="h-6 w-6 hover:bg-[#162137] text-gray-400 hover:text-white"
            >
              <ZoomOut className="h-4 w-4" />
              <span className="sr-only">Decrease text size</span>
            </Button>
            <span className="text-xs text-gray-400 mx-1">{textSize}px</span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={increaseTextSize}
              title="Increase text size"
              className="h-6 w-6 hover:bg-[#162137] text-gray-400 hover:text-white"
            >
              <ZoomIn className="h-4 w-4" />
              <span className="sr-only">Increase text size</span>
            </Button>
          </div>
          <a 
            href="https://github.com/jonthewayne/v0-system-prompts-and-models" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
            title="View on GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </div>
      
      {/* Main carousel area */}
      <div className="flex-1 relative px-4 md:px-8 pt-2">
        <div 
          className="embla w-full h-full overflow-hidden" 
          ref={emblaRef}
        >
          <div className="embla__container h-full flex">
            {slides.map((slide, index) => (
              <div 
                key={index} 
                className={cn(
                  "embla__slide flex-shrink-0 flex-grow-0 min-w-0 w-full h-full px-4 py-2",
                  "transform transition-all duration-500",
                  activeSlide === index ? "opacity-100" : "opacity-40"
                )}
              >
                <Card className="h-full bg-[#0B1221]/80 border-[#2A3C56] text-white flex flex-col">
                  <CardHeader className="py-2 px-4 flex-shrink-0">
                    <CardTitle className="text-lg text-sky-300">{slide.title}</CardTitle>
                    <p className="text-xs text-gray-300">{slide.principle}</p>
                  </CardHeader>
                  <CardContent className="flex-1 px-4 pb-2 flex flex-col" style={{ minHeight: 0 }}>
                    <div 
                      ref={el => scrollableRefs.current[index] = el}
                      className="bg-[#070C14] rounded-lg border border-[#2A3C56] shadow-lg flex-1 custom-scrollbar"
                      tabIndex={0}
                      onClick={handleManualScroll}
                      onWheel={manualScrollHandler}
                      onKeyDown={(e) => {
                        // Prevent slide navigation when using arrow keys inside the content
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const currentRef = scrollableRefs.current[activeSlide];
                          if (currentRef) {
                            const scrollableDiv = currentRef.firstElementChild as HTMLDivElement;
                            if (scrollableDiv) {
                              scrollableDiv.scrollTop -= 100;
                            }
                          }
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const currentRef = scrollableRefs.current[activeSlide];
                          if (currentRef) {
                            const scrollableDiv = currentRef.firstElementChild as HTMLDivElement;
                            if (scrollableDiv) {
                              scrollableDiv.scrollTop += 100;
                            }
                          }
                        }
                      }}
                      style={{
                        height: "100%",
                        position: "relative",
                        overflow: "hidden",
                        outline: "none"
                      }}
                    >
                      <div
                        className="custom-scrollbar"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          overflowY: "scroll",
                          overflowX: "hidden"
                        }}
                      >
                        <pre 
                          className="whitespace-pre-wrap font-mono text-gray-300 p-4"
                          style={{ fontSize: `${textSize}px` }}
                        >
                          {slide.promptText}
                        </pre>
                        <div className="pb-20"></div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 pb-1 px-4 justify-between flex-shrink-0">
                    <p className="text-xs text-gray-300 italic">{slide.explanation}</p>
                    <p className="text-xs text-gray-500">
                      {index + 1} / {slides.length}
                    </p>
                  </CardFooter>
                </Card>
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation buttons */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-[#0B1221]/80 hover:bg-sky-900/80 text-white transition-colors duration-200" 
          onClick={scrollPrev}
        >
          <ChevronLeft className="h-6 w-6" />
          <span className="sr-only">Previous slide</span>
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-[#0B1221]/80 hover:bg-sky-900/80 text-white transition-colors duration-200" 
          onClick={scrollNext}
        >
          <ChevronRight className="h-6 w-6" />
          <span className="sr-only">Next slide</span>
        </Button>
      </div>
      
      {/* Bottom navigation */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-4 z-10">
        <div className="bg-[#0B1221] py-2 px-3 rounded-lg flex gap-1 flex-wrap justify-center shadow-lg border border-[#2A3C56]">
          {slides.map((_, index) => (
            <Button
              key={index}
              variant={activeSlide === index ? "default" : "ghost"}
              size="sm"
              onClick={() => handleJumpToSlide(index)}
              className={cn(
                "w-8 h-7 text-xs transition-all duration-200",
                activeSlide === index ? "bg-sky-700 text-white" : "text-gray-300 hover:text-white hover:bg-[#162137]"
              )}
            >
              {index + 1}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Info footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#070C14] py-1 text-center text-gray-400 text-xs flex justify-center items-center gap-2 border-t border-[#2A3C56]">
        <Info className="h-3 w-3" />
        <p>Use left/right arrows to navigate slides. Up/down arrows or mouse wheel to scroll content. Press + and - to adjust text size.</p>
      </div>
    </div>
  );
} 