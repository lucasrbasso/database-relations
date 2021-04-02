/* eslint-disable no-restricted-syntax */
import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkCustomerExists) {
      throw new AppError('Customer not found!', 400);
    }

    const productsExists = await this.productsRepository.findAllById(products);

    if (!productsExists.length) {
      throw new AppError('Products are missing!', 400);
    }

    const existIdInProducts = productsExists.map(product => product.id);
    const checkInexistentProducts = products.filter(
      product => !existIdInProducts.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `This products: ${checkInexistentProducts.map(
          product => product.id,
        )} don't exists.`,
        400,
      );
    }

    for (const product in productsExists) {
      if (productsExists[product].quantity < products[product].quantity) {
        throw new AppError(
          `Not enough quantity of ${productsExists[product].name}`,
          400,
        );
      }
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExists.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: checkCustomerExists,
      products: serializedProducts,
    });

    const newProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productsExists.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(newProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
