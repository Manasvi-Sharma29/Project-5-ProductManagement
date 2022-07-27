const productModel = require('../models/productModel')
const {uploadFiles} = require('../upload/upload')
const {isValidRequest,
        isValidString,
        isValidTitle,
        isValidPrice,
        isValidName,
        isValidSize,
        isValidId} = require('../validator/validation')


const createProduct = async function(req, res){
    try{
        if(!isValidRequest(req.body)){
            return res
                .status(400)
                .send({status:false, message: "Enter valid input"});
        };
        // let requestBody = JSON.parse(JSON.stringify(req.body))
        let {title, description, price, currencyId, currencyFormat, isFreeShipping, style, availableSizes, installments} = req.body;
        let productData ={}
        let productImage = req.files;

        //validationg product title
        if(!title){
            return res
                .status(400)
                .send({status:false, message: "Title is required"});
        }
        if(!isValidString(title) || !isValidTitle(title)){
            return res
                .status(400)
                .send({status:false, message: "Enter title in valid format"});
        }
        const isDuplicateTitle = await productModel.findOne({title: title})
        if(isDuplicateTitle){
            return res
                .status(409)
                .send({status:false, message: `${title} title is already in use`});
        }
        productData.title = title

        //validating product description
        if(!description){
            return res
                .status(400)
                .send({status:false, message: "Description is required"});
        }
        if(!isValidString(description)){
            return res
                .status(400)
                .send({status:false, message: "Enter description in valid format"});
        }
        productData.description = description

        //validating price
        if(!price){
            return res
                .status(400)
                .send({status:false, message: "Price is required"});
        }
        if(!isValidPrice(price)){
            return res
                .status(400)
                .send({status:false, message: "Enter valid price"});
        }
        productData.price = price

        //validating currencyId if given
        if(currencyId){
            if(!["INR"].includes(currencyId)){
                return res
                    .status(400)
                    .send({status:false, message: "Enter valid currency abbreviation either of Indian rupee"});
            }
            productData.currencyId = currencyId
        }
        
        //validating currencyFormat if given
        if(currencyFormat){
            if(!["₹"].includes(currencyFormat)){
                return res
                    .status(400)
                    .send({status:false, message: "Enter valid currency format either of Indian rupee"});
            }
            productData.currencyFormat = currencyFormat
        }

        //validating isFreeShipping if given
        if(isFreeShipping){
            if(!["true", "false"].includes(isFreeShipping)){
                return res
                    .status(400)
                    .send({status:false, message: "isFreeShipping should be either true or false"});
            }
            productData.isFreeShipping = isFreeShipping
        }

        //productImage validation while uploading on aws s3 service
        if(productImage.length == 0){
            return res
                .status(400)
                .send({ status: false, message: "Product Image is required" });
        }
        let match = /\.(jpeg|png|jpg)$/.test(productImage[0].originalname)
        if(match == false){
        return res
            .status(400)
            .send({status: false, message:"Product Image is required in JPEG/PNG/JPG format"})
        }
        let uploadedFileURL = await uploadFiles(productImage[0]) 
        productData.productImage = uploadedFileURL

        // validating style if given
        if(style){
            if(!isValidString(style) || !isValidName(style)){
                return res
                .status(400)
                .send({ status: false, message: "Enter valid style" });
            }
            productData.style = style
        }

        //validating availabe sizes
        if(availableSizes){
           if(!isValidSize(availableSizes)){
                return res
                    .status(400)
                    .send({ status: false, message: `Enter valid size among ${["S", "XS","M","X", "L","XXL", "XL"].join(' ')}` });
           }
           availableSizes = availableSizes.split(',')
           let sizeArr = availableSizes.map(x => x.trim())
            productData.availableSizes = sizeArr
        }

        //validating installments if given
        if(installments){
            if(/^[0-9]+$/.test(installments) == false){
                return res
                    .status(400)
                    .send({ status: false, message: "Enter valid amount for installments" });
            }
            productData.installments = installments
        }

        const product = await productModel.create(productData)
        
        return res
            .status(201)
            .send({ status: true, message: "Success", data:product });

    }
    catch(error){
        console.log(error)
        return res
            .status(500)
            .send({status: false, message: error.message})
    }
}

const getProduct = async function(req, res){
    try{
         let filters  = {isDeleted: false};
       
        const allData = await productModel.find(filters)
           
         let {size, name, priceGreaterThan, priceLessThan, priceSort} = req.query
         if(size){
            if(!isValidSize(size)){
                return res
                    .status(400)
                    .send({ status: false, message: `Enter valid size among ${["S", "XS","M","X", "L","XXL", "XL"].join(' ')}` });
            }
            size = size.split(',').map(x=>x.trim())

            console.log(size)
            filters.availableSizes = {$in:size}
         }

    if(name){
        if(!isValidString(name) || !isValidTitle(name)){
            return res
                .status(400)
                .send({ status: false, message: "Enter valid name" });
            }
            filters.title = {$regex: name}
    }

    if(priceGreaterThan && priceLessThan){
        filters.price = {$gt:priceGreaterThan, $lt:priceLessThan}
    }else{ 
    if(priceGreaterThan){
        priceGreaterThan = parseInt(priceGreaterThan)
        filters.price = {$gt:priceGreaterThan}
    }else if(priceLessThan){
        priceLessThan = parseInt(priceLessThan)
        filters.price = {$lt:priceLessThan}
    }}
    
        const products = await productModel.find(filters).sort({price:priceSort})
        if(products.length == 0){
            return res
                .status(404)
                .send({ status: false, message: "No product Found" });
        }
        return res
            .status(200)
            .send({ status: true, message: "Successful", data: products });
        
    }
    catch(error){
        console.log(error)
        return res
            .status(500)
            .send({status: false, message: error.message})
    }
}


const getProductById = async function(req, res){
    try{
        if(!isValidId(req.params.productId)){
            return res
                .status(400)
                .send({status: false, message: "Enter Id in valid objectId format"})
        }

        let productId = req.params.productId
        const dataById = await productModel.findOne({_id:productId, isDeleted:false})
        if(!dataById){
            return res
                .status(404)
                .send({status: false, message: "No product found"})
        }

        return res
            .status(200)
            .send({status: true, message: "Successful", data: dataById})
    }
    catch(error){
        console.log(error)
        return res
            .status(500)
            .send({status: false, message: error.message})
    }
} 
module.exports = {createProduct,
                  getProduct,
                    getProductById}