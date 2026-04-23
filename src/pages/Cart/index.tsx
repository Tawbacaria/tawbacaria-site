import { useEffect, useState } from 'react';
import { Base64 } from 'js-base64';
import {
    Heading,
    Container,
    Text,
    Button,
    Stack,
    Flex,
    TableContainer,
    Table,
    Thead,
    Tr,
    Th,
    Tbody,
    Td,
    Image,
    Select,
    Input,
    FormLabel,
    FormControl,
    FormErrorMessage,
    RadioGroup,
    Radio,
    NumberInput,
    NumberInputField,
    IconButton,
    useColorModeValue,
} from '@chakra-ui/react';
import useShoppingCart from '../../hooks/useShoppingCart';
import {
    buildAndEncodeMessage,
    formatToCurrency,
    generateThumbnailUrl,
    getLocalStorageObjectSafely,
    getSessionStorageObjectSafely,
    isInWorkingTime,
    parseCurrency,
} from '../../utils';
import { AiOutlineMinus, AiOutlinePlus } from 'react-icons/ai';
import { FaTimesCircle } from 'react-icons/fa';

import deliveryFeeData from '../../assets/delivery_fee.json';
import SetAddressModal from '../../components/SetAddressModal';
import { Link, useNavigate } from 'react-router-dom';
import useCurrentTimeContext from '../../hooks/useCurrentTime';

const storageKeyName = 'tawbacaria-app-user-name';
const storageKeyPayment = 'tawbacaria-app-user-payment';
const storageKeyAddress = 'tawbacaria-app-address';
const storageKeyRetire = 'tawbacaria-app-retire';

const buildAddressText = (data: AddressInfo | null) => {
    return data
        ? `${data.address} ${data.number}, ${data.district}, Presidente Epitácio - SP`
        : null;
};

const getAddress: () => AddressInfo | null = () => {
    return getLocalStorageObjectSafely<AddressInfo>(storageKeyAddress);
};

type PaymentMethod = {
    method: string;
    change: boolean | null;
    changeValue: string;
};

export default function Cart() {
    const [buttonLoading, setButtonLoading] = useState(false);
    const navigate = useNavigate();

    const { getCurrentDate, date } = useCurrentTimeContext();
    const { items, setCount, clearItem, isCartInSync } = useShoppingCart();
    const [itemCount, setItemCount] = useState<{ [key: string]: string }>(
        () => {
            const i: { [key: string]: string } = {};
            Object.values(items).forEach((item) => {
                i[item.code] = item.count.toString();
            });
            return i;
        }
    );
    const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
        getSessionStorageObjectSafely<PaymentMethod>(storageKeyPayment) ?? {
            method: '',
            change: null,
            changeValue: '',
        }
    );
    const [userName, setUserName] = useState(
        localStorage.getItem(storageKeyName) ?? ''
    );
    const [toRetire, setToRetire] = useState(
        localStorage.getItem(storageKeyRetire) ?? ''
    );

    useEffect(() => {
        sessionStorage.setItem(
            storageKeyPayment,
            JSON.stringify(paymentMethod)
        );
    }, [paymentMethod]);

    useEffect(() => {
        localStorage.setItem(storageKeyName, userName);
    }, [userName]);

    useEffect(() => {
        localStorage.setItem(storageKeyRetire, toRetire);
    }, [toRetire]);

    useEffect(() => {
        Object.entries(itemCount).forEach(([key, value]) => {
            const num = Number(value);
            if (isNaN(num)) return;
            setCount(key, num);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemCount]);

    const seeItensButton = (
        <Link to='/produtos'>
            <Button variant={'link'} colorScheme={'blue'} size={'sm'}>
                Ver produtos
            </Button>
        </Link>
    );

    const savedAddress = getAddress();
    const deliveryDistrict =
        savedAddress && savedAddress?.district !== '' && toRetire === 'no'
            ? deliveryFeeData[
                  savedAddress.district as keyof typeof deliveryFeeData
              ]
            : null;
    const freeDeliveryPrice = deliveryDistrict?.freeAbove ?? null;

    const totalPriceNoFee = Object.values(items).reduce(
        (prev, curr) => prev + curr.price * (curr.count <= 0 ? 1 : curr.count),
        0
    );

    const isDeliveryFree = !!freeDeliveryPrice && 
        totalPriceNoFee >= freeDeliveryPrice && 
        ['Dinheiro', 'PIX'].includes(paymentMethod.method);
    const deliveryFee = deliveryDistrict?.price ?? 0;
    const totalPrice = totalPriceNoFee + (!isDeliveryFree ? deliveryFee : 0);

    const textAddress =
        toRetire === 'no' ? buildAddressText(savedAddress) : null;

    const changeNumeric =
        paymentMethod.change && paymentMethod.changeValue
            ? Number(paymentMethod.changeValue)
            : null;
    const neededChange =
        totalPrice && changeNumeric ? changeNumeric - totalPrice : 0;

    const raiseAndRefresh = (message: string) => {
        alert(message);
        window.location.reload();
    };

    const handleNewRequest = () => {
        setButtonLoading(true);
        getCurrentDate().then((date) => {
            if (!isInWorkingTime(date)) {
                raiseAndRefresh('Fora do horário de atendimento, recarregando');
                return;
            }
            if (!isCartInSync(date)) {
                raiseAndRefresh(
                    'Alguns itens não estão mais disponíveis ou em promoção, recarregando'
                );
                return;
            }
            const message = buildAndEncodeMessage({
                name: userName,
                paymentMethod: paymentMethod.method,
                shoppingCart: items,
                totalPrice: totalPrice,
                deliveryFee: deliveryFee,
                isDeliveryFree : isDeliveryFree,
                changeValue: changeNumeric,
                fullAddress: textAddress,
            });
            navigate(`/finalizar?wappmessage=${Base64.encode(message)}`);
            setButtonLoading(false);
        });
    };

    const formatToValue = (value: string) => {
        const numeric = Number(value);
        return `${formatToCurrency(numeric / 100)}`;
    };

    const updateItemCount = (code: string, value: string) => {
        setItemCount((old) => ({
            ...old,
            [code]: value,
        }));
    };

    const ErrorText: React.FC<React.PropsWithChildren> = ({ children }) => (
        <Text color={useColorModeValue('red.500', 'red.300')}>{children}</Text>
    );

    const isShopOpen = isInWorkingTime(date);
    const finishButtonDisabled =
        toRetire === '' ||
        (toRetire === 'no' && savedAddress == null) ||
        userName === '' ||
        paymentMethod.method === '' ||
        (paymentMethod.method === 'Dinheiro' &&
            (paymentMethod.change == null ||
                (paymentMethod.change === true && neededChange <= 0)));

    return (
        <Container maxW={'5xl'}>
            <SetAddressModal
                isOpen={isAddressModalVisible}
                onClose={() => setIsAddressModalVisible(false)}
            />
            <Heading
                fontWeight={600}
                fontSize={{ base: '2xl', sm: '4xl', md: '4xl' }}
                lineHeight={'110%'}
            >
                Seu carrinho
            </Heading>
            <Stack
                direction={'column'}
                spacing={3}
                align={'center'}
                alignSelf={'center'}
                position={'relative'}
            >
                {Object.keys(items).length <= 0 ? (
                    <>
                        <Heading
                            mt='8'
                            fontWeight={600}
                            fontSize={{ base: '2xl', sm: '3xl', md: '4xl' }}
                        >
                            Carrinho vazio!
                        </Heading>
                        {seeItensButton}
                    </>
                ) : (
                    <>
                        <TableContainer>
                            <Table variant='simple'>
                                <Thead>
                                    <Tr>
                                        <Th>Seus itens</Th>
                                        <Th>Preço unitário</Th>
                                        <Th isNumeric>Quantia</Th>
                                        <Th isNumeric>Total</Th>
                                        <Th></Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {Object.values(items)
                                        .sort((item, prevItem) =>
                                            item.label > prevItem.label
                                                ? 1
                                                : item.label < prevItem.label
                                                ? -1
                                                : 0
                                        )
                                        .map((item) => (
                                            <Tr
                                                key={item.code}
                                                alignItems='center'
                                                position='relative'
                                                overflow='visible'
                                            >
                                                <Td>
                                                    <Flex
                                                        align='center'
                                                        gap='2'
                                                    >
                                                        {item.image_url && (
                                                            <Image
                                                                src={generateThumbnailUrl(
                                                                    item.image_url,
                                                                    'small'
                                                                )}
                                                                alt={item.label}
                                                                rounded='lg'
                                                                maxW='52px'
                                                            />
                                                        )}
                                                        {item.label}
                                                    </Flex>
                                                </Td>
                                                <Td>
                                                    R${' '}
                                                    {formatToCurrency(
                                                        item.price / 100
                                                    )}
                                                </Td>
                                                <Td isNumeric>
                                                    <Flex
                                                        align='center'
                                                        gap='2'
                                                    >
                                                        <IconButton
                                                            aria-label='Decrementar item'
                                                            icon={
                                                                <AiOutlineMinus />
                                                            }
                                                            isDisabled={
                                                                item.count <= 1
                                                            }
                                                            onClick={() =>
                                                                updateItemCount(
                                                                    item.code,
                                                                    (
                                                                        item.count -
                                                                        1
                                                                    ).toString()
                                                                )
                                                            }
                                                        />
                                                        <NumberInput
                                                            minW='100px'
                                                            maxW='100px'
                                                            value={
                                                                itemCount[
                                                                    item.code
                                                                ]
                                                            }
                                                            onBlur={() => {
                                                                if (
                                                                    itemCount[
                                                                        item
                                                                            .code
                                                                    ] === ''
                                                                ) {
                                                                    updateItemCount(
                                                                        item.code,
                                                                        '1'
                                                                    );
                                                                }
                                                            }}
                                                            onChange={(val) => {
                                                                if (
                                                                    val.length >
                                                                    3
                                                                ) {
                                                                    updateItemCount(
                                                                        item.code,
                                                                        val.substring(
                                                                            0,
                                                                            3
                                                                        )
                                                                    );
                                                                    return;
                                                                }
                                                                if (
                                                                    val === ''
                                                                ) {
                                                                    updateItemCount(
                                                                        item.code,
                                                                        ''
                                                                    );
                                                                    return;
                                                                }
                                                                const num =
                                                                    Number(val);
                                                                if (
                                                                    isNaN(
                                                                        num
                                                                    ) ||
                                                                    num <= 0
                                                                )
                                                                    updateItemCount(
                                                                        item.code,
                                                                        '1'
                                                                    );
                                                                else
                                                                    updateItemCount(
                                                                        item.code,
                                                                        val
                                                                    );
                                                            }}
                                                        >
                                                            <NumberInputField
                                                                min='1'
                                                                max='100'
                                                            />
                                                        </NumberInput>
                                                        <IconButton
                                                            aria-label='Incrementar item'
                                                            icon={
                                                                <AiOutlinePlus />
                                                            }
                                                            isDisabled={
                                                                item.count >=
                                                                999
                                                            }
                                                            onClick={() =>
                                                                updateItemCount(
                                                                    item.code,
                                                                    (
                                                                        item.count +
                                                                        1
                                                                    ).toString()
                                                                )
                                                            }
                                                        />
                                                    </Flex>
                                                </Td>
                                                <Td
                                                    isNumeric
                                                    position='relative'
                                                >
                                                    R${' '}
                                                    {formatToCurrency(
                                                        (item.price / 100) *
                                                            (item.count <= 0
                                                                ? 1
                                                                : item.count)
                                                    )}
                                                </Td>
                                                <Td>
                                                    <IconButton
                                                        aria-label='Remover item'
                                                        icon={<FaTimesCircle />}
                                                        onClick={() =>
                                                            clearItem(item)
                                                        }
                                                        size='sm'
                                                    />
                                                </Td>
                                            </Tr>
                                        ))}
                                </Tbody>
                            </Table>
                        </TableContainer>
                        {isShopOpen && (
                            <>
                                <Flex>
                                    <FormControl
                                        isRequired
                                        isInvalid={toRetire == ''}
                                    >
                                        <FormLabel>
                                            Retirar produto no local?
                                        </FormLabel>
                                        <RadioGroup
                                            onChange={(value) =>
                                                setToRetire(value)
                                            }
                                            value={toRetire}
                                        >
                                            <Stack direction='row'>
                                                <Radio value='yes'>Sim</Radio>
                                                <Radio value='no'>Não</Radio>
                                            </Stack>
                                        </RadioGroup>
                                        <FormErrorMessage>
                                            Obrigatório
                                        </FormErrorMessage>
                                    </FormControl>
                                </Flex>
                                <Flex
                                    direction='column'
                                    align='center'
                                    justifyContent='center'
                                >
                                    {toRetire === 'no' && (
                                        <FormControl
                                            isRequired
                                            isInvalid={savedAddress == null}
                                        >
                                            <Flex gap='4' align='center'>
                                                <Text>
                                                    {textAddress ??
                                                        'Endereço de entrega ainda não definido'}
                                                </Text>
                                                <Button
                                                    colorScheme={'blue'}
                                                    bg={'blue.400'}
                                                    onClick={() =>
                                                        setIsAddressModalVisible(
                                                            true
                                                        )
                                                    }
                                                    size='sm'
                                                >
                                                    {savedAddress
                                                        ? 'Alterar'
                                                        : 'Definir'}
                                                </Button>
                                            </Flex>
                                            <FormErrorMessage>
                                                Obrigatório
                                            </FormErrorMessage>
                                        </FormControl>
                                    )}
                                </Flex>
                            </>
                        )}
                        {isDeliveryFree && <Text fontSize='3xl'>
                            Total:{' '}
                            <span  style={{ fontSize: '1rem', textDecoration: 'line-through', marginRight: '8px' }}>
                                R$ {formatToCurrency((totalPrice + deliveryFee) / 100)}
                            </span>
                            <span style={{ fontWeight: 'bold' }}>
                                R$ {formatToCurrency(totalPrice / 100)}
                            </span>
                        </Text>}
                        {!isDeliveryFree && <Text fontSize='3xl'>
                            Total:{' '}
                            <span style={{ fontWeight: 'bold' }}>
                                R$ {formatToCurrency(totalPrice / 100)}
                            </span>
                        </Text>}
                        {!isShopOpen && (
                            <ErrorText>
                                Não é possível realizar pedido fora do horário
                            </ErrorText>
                        )}
                        {isShopOpen && (
                            <>
                                {isDeliveryFree && (
                                    <Text fontSize='md' fontWeight='bold' color='green.500'>Frete grátis!</Text>
                                )}
                                {!isDeliveryFree && !!deliveryFee && (
                                    <Text fontSize='md'>
                                        (Inclui frete:{' '}
                                        <span style={{ fontWeight: 'bold' }}>
                                            R${' '}
                                            {formatToCurrency(
                                                deliveryFee / 100
                                            )}
                                        </span>
                                        )
                                    </Text>
                                )}
                            </>
                        )}
                        {isShopOpen && (
                            <>
                                <Flex gap='4' direction='column'>
                                    <FormControl
                                        isRequired
                                        isInvalid={userName === ''}
                                    >
                                        <FormLabel>Seu nome/apelido</FormLabel>
                                        <Input
                                            value={userName}
                                            onChange={(e) =>
                                                setUserName(e.target.value)
                                            }
                                        />
                                        <FormErrorMessage>
                                            Obrigatório
                                        </FormErrorMessage>
                                    </FormControl>
                                    <FormControl
                                        isRequired
                                        isInvalid={paymentMethod.method === ''}
                                    >
                                        <FormLabel>
                                            {freeDeliveryPrice ? 
                                                `Forma de pagamento (frete grátis apenas para compras acima de R$ ${formatToCurrency(freeDeliveryPrice/100)} e pagas no dinheiro/PIX)` : 
                                                `Forma de pagamento (frete grátis apenas para compras no dinheiro/PIX)`}
                                        </FormLabel>
                                        <Select
                                            value={paymentMethod.method}
                                            onChange={(e) =>
                                                setPaymentMethod((old) => ({
                                                    ...old,
                                                    method: e.target.value,
                                                }))
                                            }
                                        >
                                            <option hidden disabled value=''>
                                                Selecione a forma de pagamento
                                            </option>
                                            <option value='Cartão (Crédito)'>
                                                Cartão (Crédito)
                                            </option>
                                            <option value='Cartão (Débito)'>
                                                Cartão (Débito)
                                            </option>
                                            <option value='Dinheiro'>
                                                Dinheiro
                                            </option>
                                            <option value='PIX'>PIX</option>
                                        </Select>
                                        <FormErrorMessage>
                                            Obrigatório
                                        </FormErrorMessage>
                                    </FormControl>
                                    {paymentMethod.method === 'PIX' && (
                                        <Text
                                            maxW='280px'
                                            mx='auto'
                                            fontSize='xs'
                                        >
                                            O pagamento por PIX poderá ser
                                            efetuado após o pedido ser
                                            confirmado pelo estabelecimento no
                                            WhatsApp.
                                        </Text>
                                    )}
                                    {paymentMethod.method === 'Dinheiro' && (
                                        <>
                                            <FormControl
                                                isRequired
                                                isInvalid={
                                                    paymentMethod.change == null
                                                }
                                            >
                                                <FormLabel>
                                                    Precisa de troco?
                                                </FormLabel>
                                                <RadioGroup
                                                    onChange={(value) =>
                                                        setPaymentMethod(
                                                            (old) => ({
                                                                ...old,
                                                                change:
                                                                    value ===
                                                                    'yes'
                                                                        ? true
                                                                        : false,
                                                            })
                                                        )
                                                    }
                                                    value={
                                                        paymentMethod.change ==
                                                        null
                                                            ? ''
                                                            : paymentMethod.change
                                                            ? 'yes'
                                                            : 'no'
                                                    }
                                                >
                                                    <Stack direction='row'>
                                                        <Radio value='yes'>
                                                            Sim
                                                        </Radio>
                                                        <Radio value='no'>
                                                            Não
                                                        </Radio>
                                                    </Stack>
                                                </RadioGroup>
                                                <FormErrorMessage>
                                                    Obrigatório
                                                </FormErrorMessage>
                                            </FormControl>
                                            {paymentMethod.change === true && (
                                                <FormControl
                                                    isRequired
                                                    isInvalid={
                                                        neededChange <= 0
                                                    }
                                                >
                                                    <FormLabel>
                                                        Troco para
                                                    </FormLabel>
                                                    <NumberInput
                                                        onChange={(
                                                            valueString
                                                        ) =>
                                                            setPaymentMethod(
                                                                (old) => ({
                                                                    ...old,
                                                                    changeValue:
                                                                        parseCurrency(
                                                                            valueString
                                                                        ),
                                                                })
                                                            )
                                                        }
                                                        value={formatToValue(
                                                            paymentMethod.changeValue
                                                        )}
                                                    >
                                                        <Flex
                                                            align='center'
                                                            gap='2'
                                                        >
                                                            <Text>R$</Text>
                                                            <NumberInputField />
                                                        </Flex>
                                                    </NumberInput>
                                                    {neededChange > 0 && (
                                                        <Text>
                                                            Troco: R${' '}
                                                            {formatToCurrency(
                                                                neededChange /
                                                                    100
                                                            )}
                                                        </Text>
                                                    )}
                                                    <FormErrorMessage>
                                                        Precisa ser superior ao
                                                        total
                                                    </FormErrorMessage>
                                                </FormControl>
                                            )}
                                        </>
                                    )}
                                </Flex>
                                <Flex gap='4'>
                                    <Button
                                        px={6}
                                        isDisabled={finishButtonDisabled}
                                        onClick={handleNewRequest}
                                        isLoading={buttonLoading}
                                        backgroundColor='purple.300'
                                        color='black'
                                        _hover={{
                                            textDecoration: 'none',
                                            bg: 'purple.400',
                                        }}
                                    >
                                        Fechar e revisar pedido
                                    </Button>
                                </Flex>
                            </>
                        )}
                    </>
                )}
            </Stack>
        </Container>
    );
}
