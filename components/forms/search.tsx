"use client"
import { File, Hash, SearchIcon } from "@yamada-ui/lucide"
import {
  ui,
  HStack,
  Kbd,
  Modal,
  ModalBody,
  Text,
  forwardRef,
  handlerAll,
  useDisclosure,
  isApple,
  Divider,
  VStack,
  ModalHeader,
  Highlight,
  dataAttr,
  useUpdateEffect,
  IconButton,
} from "@yamada-ui/react"
import type { StackProps, ModalProps, ButtonProps } from "@yamada-ui/react"
import { matchSorter } from "match-sorter"
import NextLink from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  createRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { FC, KeyboardEvent, RefObject } from "react"
import scrollIntoView from "scroll-into-view-if-needed"
import { useEventListener } from "@/hooks"
import { useI18n } from "contexts"

const ACTION_DEFAULT_KEY = "Ctrl"
const ACTION_APPLE_KEY = "⌘"

const useSearch = () => {
  const pathname = usePathname()
  const { isOpen, onOpen, onClose } = useDisclosure()

  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  return { isOpen, onOpen, onClose }
}

export type SearchProps = StackProps & {}

export const Search = memo(
  forwardRef<SearchProps, "button">(({ ...rest }, ref) => {
    const { isOpen, onOpen, onClose } = useSearch()
    const [actionKey, setActionKey] = useState(ACTION_APPLE_KEY)

    useEffect(() => {
      if (!isApple()) setActionKey(ACTION_DEFAULT_KEY)
    }, [])

    useEventListener("keydown", (ev) => {
      if (
        ev.key.toLowerCase() !== "k" ||
        !ev[isApple() ? "metaKey" : "ctrlKey"]
      )
        return

      ev.preventDefault()

      if (isOpen) {
        onClose()
      } else {
        onOpen()
      }
    })

    return (
      <>
        <HStack
          as="button"
          type="button"
          ref={ref}
          w="full"
          maxW="lg"
          h="10"
          px="3"
          outline="0"
          border="1px solid"
          bg={["white", "black"]}
          rounded="md"
          gap="sm"
          color={["blackAlpha.600", "whiteAlpha.400"]}
          _focusVisible={{ shadow: "outline" }}
          transitionProperty="common"
          transitionDuration="slower"
          {...rest}
          onClick={handlerAll(rest.onClick, onOpen)}
        >
          <SearchIcon fontSize="xl" />
          <Text flex="1">検索</Text>
          <Kbd>{actionKey} + K</Kbd>
        </HStack>

        <SearchModal isOpen={isOpen} onClose={onClose} />
      </>
    )
  }),
)

export type SearchButtonProps = ButtonProps & {}

export const SearchButton = memo(
  forwardRef<SearchButtonProps, "button">(({ ...rest }, ref) => {
    const { isOpen, onOpen, onClose } = useSearch()

    return (
      <>
        <IconButton
          type="button"
          ref={ref}
          color="muted"
          variant="ghost"
          _hover={{ bg: ["blackAlpha.100", "whiteAlpha.50"] }}
          icon={<SearchIcon fontSize="2xl" />}
          {...rest}
          onClick={handlerAll(rest.onClick, onOpen)}
        />

        <SearchModal isOpen={isOpen} onClose={onClose} />
      </>
    )
  }),
)

type SearchModalProps = ModalProps

const SearchModal: FC<SearchModalProps> = memo(
  ({ isOpen, onClose, ...rest }) => {
    const [query, setQuery] = useState<string>("")
    const [selectedIndex, setSelectedIndex] = useState<number>(0)
    const { contents } = useI18n()

    const router = useRouter()
    const eventRef = useRef<"mouse" | "keyboard" | null>(null)
    const directionRef = useRef<"up" | "down">("down")
    const compositionRef = useRef<boolean>(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<Map<number, RefObject<HTMLAnchorElement>>>(
      new Map(),
    )

    const hits = useMemo(() => {
      if (query.length < 1) return []

      return matchSorter(contents, query, {
        keys: [
          "hierarchy.lv1",
          "hierarchy.lv2",
          "hierarchy.lv3",
          "hierarchy.lv4",
          "description",
          "title",
        ],
      }).slice(0, 20)
    }, [query, contents])

    const onKeyDown = useCallback(
      (ev: KeyboardEvent<HTMLInputElement>) => {
        if (compositionRef.current) return

        eventRef.current = "keyboard"

        const actions: Record<
          string,
          (ev: KeyboardEvent<HTMLInputElement>) => void | undefined
        > = {
          ArrowDown: () => {
            if (selectedIndex === hits.length) return

            directionRef.current = "down"
            setSelectedIndex(selectedIndex + 1)
          },
          ArrowUp: () => {
            if (selectedIndex === 0) return

            directionRef.current = "up"
            setSelectedIndex(selectedIndex - 1)
          },
          Enter: () => {
            if (!query) return

            onClose?.()
            if (selectedIndex === 0) {
              router.push(`/tag-search?query=${encodeURIComponent(query)}`)
            } else {
              router.push(hits[selectedIndex].slug)
            }
          },
          Home: () => {
            directionRef.current = "up"
            setSelectedIndex(0)
          },
          End: () => {
            directionRef.current = "down"
            setSelectedIndex(hits.length)
          },
        }

        const action = actions[ev.key]

        if (!action) return

        ev.preventDefault()
        ev.stopPropagation()

        action(ev)
      },
      [hits, onClose, selectedIndex, router, query],
    )

    useEffect(() => {
      if (isOpen) return

      setQuery("")
    }, [isOpen])

    useUpdateEffect(() => {
      setSelectedIndex(0)
    }, [query])

    useUpdateEffect(() => {
      if (!containerRef.current || eventRef.current === "mouse") return

      const itemRef = itemRefs.current.get(selectedIndex)

      if (!itemRef?.current) return

      scrollIntoView(itemRef.current, {
        behavior: (actions) =>
          actions.forEach(({ el, top }) => {
            if (directionRef.current === "down") {
              el.scrollTop = top + 16
            } else {
              el.scrollTop = top - 17
            }
          }),
        scrollMode: "if-needed",
        block: "nearest",
        inline: "nearest",
        boundary: containerRef.current,
      })
    }, [selectedIndex])

    return (
      <Modal
        size="3xl"
        withCloseButton={false}
        placement="top"
        isOpen={isOpen}
        onClose={onClose}
        {...rest}
      >
        <ModalHeader fontWeight="normal" fontSize="md" pb="md">
          <HStack position="relative" w="full">
            <ui.input
              flex="1"
              pl="lg"
              placeholder="検索"
              maxLength={64}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              onKeyDown={onKeyDown}
              onCompositionStart={() => {
                compositionRef.current = true
              }}
              onCompositionEnd={() => {
                compositionRef.current = false
              }}
            />

            <SearchIcon
              fontSize="2xl"
              position="absolute"
              top="50%"
              left="0"
              transform="translateY(-50%)"
              color={["blackAlpha.700", "whiteAlpha.600"]}
              pointerEvents="none"
            />
          </HStack>
        </ModalHeader>

        {query && (
          <ModalBody ref={containerRef} my="0" pb="md">
            <Divider />

            <VStack as="ul" gap="sm">
              <HStack
                as={NextLink}
                href={`/tag-search?query=${encodeURIComponent(query)}`}
                gap="2"
                borderWidth="1px"
                rounded="md"
                minH="16"
                py="sm"
                px="md"
                bg={["blackAlpha.50", "whiteAlpha.50"]}
                data-selected={dataAttr(selectedIndex === 0)}
                transitionProperty="colors"
                transitionDuration="normal"
                _focus={{ outline: "none" }}
                _focusVisible={{ boxShadow: "outline" }}
                _hover={{ boxShadow: "outline" }}
                _selected={{ boxShadow: "outline" }}
                _active={{}}
                onClick={onClose}
                onMouseEnter={() => {
                  eventRef.current = "mouse"
                  setSelectedIndex(0)
                }}
              >
                <SearchIcon
                  fontSize="2xl"
                  color={["blackAlpha.700", "whiteAlpha.600"]}
                />

                <VStack gap="0">
                  <Highlight
                    query={query}
                    markProps={{ variant: "text-accent" }}
                    lineClamp={1}
                  >
                    {`${query}でタグ検索`}
                  </Highlight>
                </VStack>
              </HStack>

              {hits.length
                ? hits.map(({ title, type, slug, hierarchy }, index) => {
                    // ここで+1しているのは、タグ検索を追加するため
                    const shiftedIndex = index + 1
                    const isSelected = shiftedIndex === selectedIndex
                    const ref = createRef<HTMLAnchorElement>()

                    itemRefs.current.set(index, ref)

                    return (
                      <HStack
                        as={NextLink}
                        ref={ref}
                        key={slug}
                        href={slug}
                        gap="2"
                        borderWidth="1px"
                        rounded="md"
                        minH="16"
                        py="sm"
                        px="md"
                        data-selected={dataAttr(isSelected)}
                        bg={["blackAlpha.50", "whiteAlpha.50"]}
                        transitionProperty="colors"
                        transitionDuration="normal"
                        _focus={{ outline: "none" }}
                        _focusVisible={{ boxShadow: "outline" }}
                        _hover={{ boxShadow: "outline" }}
                        _selected={{ boxShadow: "outline" }}
                        _active={{}}
                        onClick={onClose}
                        onMouseEnter={() => {
                          eventRef.current = "mouse"
                          setSelectedIndex(shiftedIndex)
                        }}
                      >
                        {type === "page" ? (
                          <File
                            fontSize="2xl"
                            color={["blackAlpha.700", "whiteAlpha.600"]}
                          />
                        ) : (
                          <Hash
                            fontSize="2xl"
                            color={["blackAlpha.500", "whiteAlpha.400"]}
                          />
                        )}

                        <VStack gap="0">
                          {type === "fragment" ? (
                            <Highlight
                              fontSize="xs"
                              color="muted"
                              lineClamp={1}
                              query={query}
                              markProps={{ variant: "text-accent" }}
                            >
                              {hierarchy.lv1}
                            </Highlight>
                          ) : null}

                          <Highlight
                            query={query}
                            markProps={{ variant: "text-accent" }}
                            lineClamp={1}
                          >
                            {title}
                          </Highlight>
                        </VStack>
                      </HStack>
                    )
                  })
                : null}
            </VStack>
          </ModalBody>
        )}
      </Modal>
    )
  },
)

SearchModal.displayName = "SearchModal"
